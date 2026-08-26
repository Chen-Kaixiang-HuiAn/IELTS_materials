#!/usr/bin/env python3
# align_lyrics.py — Forced-alignment LRC generator for IELTS Listening.
#
# Method: align the OFFICIAL transcript directly to the audio using a wav2vec2
# CTC acoustic model (torchaudio WAV2VEC2_ASR_LARGE_LV60K_960H) via ctc_segmentation.
# This gives frame-level (~20 ms) word timestamps — far more accurate than
# whisper's coarse word timestamps. Output matches the player's word-LRC format:
#   [mm:ss.xxx]SPEAKER: <mm:ss.xxx>word <mm:ss.xxx>word ...
#
# Usage:
#   align_lyrics.py --test  Cam14 Test1 Section1     # align one, print LRC + timing
#   align_lyrics.py --one   Cam14 Test1 Section1     # align one and WRITE its .lrc
#   align_lyrics.py --all                            # align every missing section
#
import os, re, sys, json, time, argparse, logging
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
logging.basicConfig(level=logging.WARNING)
import warnings; warnings.filterwarnings("ignore")
import numpy as np
import torch, torchaudio
import librosa
from ctc_segmentation import ctc_segmentation, CtcSegmentationParameters, prepare_text, determine_utterance_segments
from num2words import num2words

BASE = r"E:\ConsHein\IELTS\IELTS_materials\Listening-audios"
TRANS_DIR = os.path.join(BASE, "transcripts", "lyrics")
PROGRESS_MD = os.path.join(BASE, "PROGRESS.md")

BUNDLE = torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H
SR = BUNDLE.sample_rate
FRAME_S = 320.0 / SR            # wav2vec2: 320 samples / 16kHz = 0.02 s
LABELS = BUNDLE.get_labels()
CHAR_SET = set(LABELS)

MODEL = None
def get_model():
    global MODEL
    if MODEL is None:
        MODEL = BUNDLE.get_model()
        MODEL.eval()
        if torch.cuda.is_available():
            MODEL = MODEL.cuda()
    return MODEL

# ───────────────────────── text normalization ─────────────────────────
def _clean(sp):
    sp = sp.lower().replace("-", " ")
    sp = re.sub(r"[^a-z' ]", "", sp)
    return sp.strip()

def _number_to_words(token):
    """token is pure digits (commas/spaces allowed). Return spoken form or None."""
    digs = re.sub(r"[ ,]", "", token)
    if not digs:
        return None
    try:
        n = int(digs)
    except ValueError:
        return None
    try:
        if len(digs) >= 5:
            # reference / phone-like: spell digit by digit
            return _clean(" ".join(num2words(int(d), to="cardinal") for d in digs))
        if 1000 <= n <= 2999:
            tail = num2words(n % 100) if n % 100 != 0 else "hundred"
            return _clean(num2words(n // 100) + " " + tail)
        return _clean(num2words(n, to="cardinal"))
    except Exception:
        return None

def norm_word(w):
    """Return the alignment form of a word (lowercase a-z + space + apostrophe),
    or '' if it should be dropped from alignment. Final upper-casing / A-Z
    filtering happens in align_section (the CTC model is uppercase-only)."""
    w0 = w.lower().strip(".,;:!?\"'()[]{}…—‑-")
    w0 = re.sub(r"^[£$€¥]", "", w0)          # strip currency symbols
    if not w0:
        return ""
    # ordinal: 14th, 1st, 21st, 2nd, 3rd
    m = re.fullmatch(r"([0-9]+)(st|nd|rd|th)", w0)
    if m:
        try:
            return _clean(num2words(int(m.group(1)), to="ordinal"))
        except Exception:
            pass
    # pure digits (commas/spaces allowed)
    if re.fullmatch(r"[0-9][0-9 ,]*", w0):
        return _number_to_words(w0) or ""
    # mixed alphanumeric (MP3, 3D, ...): keep letters/apostrophes only
    return re.sub(r"[^a-z']", "", w0)

# ───────────────────────── transcript parsing ─────────────────────────
SPK_RE = re.compile(r"^([A-Z][A-Z .'’\-]*?):\s?(.*)$")

def parse_transcript(path):
    """Return list of turns: [speaker_or_None, [line_body, ...]]."""
    turns, cur_spk, cur_lines = [], None, None
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            m = SPK_RE.match(line.strip())
            if m:
                cur_spk = m.group(1).strip()
                body = m.group(2).strip()
                cur_lines = []
                turns.append([cur_spk, cur_lines])
                if body:
                    cur_lines.append(body)
            else:
                if cur_lines is None:
                    cur_lines = []
                    turns.append([None, cur_lines])
                if line.strip():
                    cur_lines.append(line.strip())
    return turns

def build_lines(turns):
    """Flatten turns into line dicts with speaker (only first line of a turn),
    orig words, and normalized (alignable) words."""
    lines, prev_spk = [], None
    for spk, bodies in turns:
        for body in bodies:
            body = re.sub(r"\([^)]*\)", " ", body)        # drop stage directions
            body = re.sub(r"\[[^\]]*\]", " ", body)
            body = re.sub(r"\s+", " ", body).strip()
            if not body:
                continue
            orig = body.split(" ")
            norm = [norm_word(w) for w in orig]
            emit = spk if spk != prev_spk else None
            prev_spk = spk
            lines.append({"speaker": emit, "orig": orig, "norm": norm})
    return lines

# ───────────────────────── alignment ─────────────────────────
CHUNK_S = 30     # seconds per inference window (CPU-safe; wav2vec2 self-attention is O(L^2))
OVERLAP_S = 6    # seconds of overlap between windows, averaged in log-domain

def load_audio(path, sr=SR):
    """Decode via audioread (soundfile/mpg123 backend chokes on these mp3s),
    mix to mono, resample to 16 kHz, return (1, n_samples) float32 tensor."""
    import audioread
    with audioread.audio_open(path) as f:
        sr0 = f.samplerate
        ch = f.channels
        raw = np.concatenate(
            [np.frombuffer(b, dtype=np.int16).astype(np.float32) / 32768.0
             for b in f])
    if ch > 1:
        raw = raw.reshape(-1, ch).T
        mono = raw.mean(axis=0)
    else:
        mono = raw
    if sr0 != sr:
        mono = librosa.resample(mono, orig_sr=sr0, target_sr=sr)
    return torch.from_numpy(mono.astype(np.float32)).unsqueeze(0), sr

def _infer(model, waveform):
    """Run wav2vec2 over the waveform in overlapping CHUNK_S windows, averaging
    the overlap region in log-space so every kept frame comes from a
    well-contexted interior (avoids chunk-boundary discontinuities that
    ctc_segmentation otherwise reads as long silences). Returns (T, vocab)."""
    n = waveform.shape[1]
    W = int(CHUNK_S * SR)
    OV = int(OVERLAP_S * SR)
    step = W - OV
    ovf = int(round(OV / 320.0))      # overlap length in frames (~)
    global_lp = None
    s = 0
    while True:
        e = min(s + W, n)
        if e - s < 320:
            break
        w = waveform[:, s:e]
        with torch.no_grad():
            out = model(w)
        em = out[0] if isinstance(out, (tuple, list)) else out
        lp = torch.log_softmax(em, -1).squeeze(0).cpu().numpy().astype(np.float32)
        nf = lp.shape[0]
        if global_lp is None:
            global_lp = lp.copy()
        else:
            k = min(ovf, global_lp.shape[0], nf)
            # average the overlapping frames in log-domain
            global_lp[-k:] = np.logaddexp(global_lp[-k:], lp[:k]) - np.log(2.0)
            global_lp = np.concatenate([global_lp, lp[k:]], axis=0)
        if e >= n:
            break
        s += step
    if global_lp is None:
        return np.zeros((0, len(LABELS)), dtype=np.float32)
    return global_lp

def align_section(mp3_path, lines):
    model = get_model()
    waveform, sr = load_audio(mp3_path)
    lpz = _infer(model, waveform)
    dur = waveform.shape[1] / SR

    # Build global word list (one utterance per original word).
    # The CTC model is uppercase-only (A-Z, blank='-', space='|'), so we
    # uppercase and keep only A-Z (spaces become blanks via config).
    words_meta = []          # (line_idx, word_idx, model_word)
    text_list = []
    for li, ln in enumerate(lines):
        for wi, nw in enumerate(ln["norm"]):
            if not nw:
                continue
            up = nw.upper().replace("'", "")
            up = re.sub(r"[^A-Z ]", "", up).strip()
            if not up:
                continue
            words_meta.append((li, wi, up))
            text_list.append(up)
    if not text_list:
        return {}, dur

    config = CtcSegmentationParameters()
    config.char_list = LABELS
    config.blank = 0
    config.index_duration = FRAME_S
    config.space = " "
    config.replace_spaces_with_blanks = True
    config.excluded_characters = ""
    config.min_window_size = 8000
    config.max_window_size = 200000

    ground_truth_mat, utt_begin = prepare_text(config, text_list)
    try:
        timings, char_probs, state_list = ctc_segmentation(config, lpz, ground_truth_mat)
        segments = determine_utterance_segments(config, utt_begin, char_probs, timings, text_list)
    except Exception as e:
        logging.error("ctc_segmentation failed: %s", e)
        return {}, dur

    word_times = {}
    for (li, wi, _), seg in zip(words_meta, segments):
        start = float(seg[0])
        word_times[(li, wi)] = max(0.0, min(start, dur))
    return word_times, dur

# ───────────────────────── LRC building ─────────────────────────
def fmt(t):
    t = max(0.0, t)
    m = int(t // 60)
    s = t - m * 60
    return f"{m:02d}:{s:06.3f}"

def build_lrc(lines, word_times, dur):
    out, prev_end = [], 0.0
    for li, ln in enumerate(lines):
        row = [word_times.get((li, wi)) for wi in range(len(ln["orig"]))]
        known = [(wi, row[wi]) for wi in range(len(row)) if row[wi] is not None]
        # interpolate gaps evenly between known neighbors
        for k in range(len(row)):
            if row[k] is None:
                p = next((j for j in range(k - 1, -1, -1) if row[j] is not None), None)
                n = next((j for j in range(k + 1, len(row)) if row[j] is not None), None)
                if p is not None and n is not None:
                    row[k] = row[p] + (row[n] - row[p]) * (k - p) / (n - p)
                elif p is not None:
                    row[k] = row[p] + 0.25
                elif n is not None:
                    row[k] = max(0.0, row[n] - 0.25)
                else:
                    row[k] = prev_end
        # monotonic clamp
        last = prev_end
        for k in range(len(row)):
            if row[k] is None:
                row[k] = last
            if row[k] < last:
                row[k] = last
            last = row[k]
        line_start = row[0] if row else prev_end
        parts = []
        if ln["speaker"]:
            parts.append(ln["speaker"] + ":")
        for wi, w in enumerate(ln["orig"]):
            parts.append(f"<{fmt(row[wi])}>{w}")
        out.append("[" + fmt(line_start) + "]" + " ".join(parts))
        if known:
            prev_end = max(t for _, t in known)
    return "\n".join(out) + "\n"

# ───────────────────────── orchestration ─────────────────────────
def audio_path(cam, test, sec):
    return os.path.join(BASE, f"Cambridge IELTS {cam}", f"Test {test}",
                        f"IELTS{cam}-Test {test}-Section {sec}.mp3")

def txt_path(cam, test, sec):
    return os.path.join(TRANS_DIR, f"Cam{cam}", f"Test{test}", f"Section{sec}.txt")

def lrc_path(cam, test, sec):
    return os.path.join(TRANS_DIR, f"Cam{cam}", f"Test{test}", f"Section{sec}.lrc")

def all_sections():
    secs = []
    for cam in range(14, 22):
        for test in (1, 2, 3, 4):
            for sec in (1, 2, 3, 4):
                if os.path.exists(txt_path(cam, test, sec)):
                    secs.append((cam, test, sec))
    return secs

def process_one(cam, test, sec, write=False):
    mp3 = audio_path(cam, test, sec)
    txt = txt_path(cam, test, sec)
    lines = build_lines(parse_transcript(txt))
    t0 = time.time()
    word_times, dur = align_section(mp3, lines)
    dt = time.time() - t0
    lrc = build_lrc(lines, word_times, dur)
    if write:
        with open(lrc_path(cam, test, sec), "w", encoding="utf-8") as f:
            f.write(lrc)
    return lrc, dt, dur, len(lines)

def write_progress(done, total, start_t, errors):
    elapsed = time.time() - start_t
    rate = done / elapsed if elapsed > 0 else 0
    eta = (total - done) / rate if rate > 0 else 0
    with open(PROGRESS_MD, "w", encoding="utf-8") as f:
        f.write("# LRC 强制对齐进度（实时）\n\n")
        f.write(f"- 方法：wav2vec2-large CTC 强制对齐（帧级 ~20ms 时间戳）\n")
        f.write(f"- 开始时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- 进度：**{done}/{total}**  ({100.0*done/total:.1f}%)\n")
        f.write(f"- 已用：{elapsed/3600:.2f} h ｜ 速率：{rate*3600:.1f} 段/h ｜ 预计剩余：{eta/3600:.2f} h\n")
        if errors:
            f.write(f"- 失败段落：{len(errors)} → " + ", ".join(errors[:20]) + "\n")
        f.write("\n> 进度每完成一段自动更新。\n")

def _norm_id(x):
    """Accept 'Cam14'/'Test1'/'Section1' OR plain '14'/'1'/'1' → int."""
    x = str(x).strip()
    for p in ("Cambridge IELTS", "Cambridge", "Cam", "Test", "Section", "Sec"):
        if x.lower().startswith(p.lower()):
            x = x[len(p):]
    return int(x.strip("-_ "))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", nargs=3, metavar=("CAM", "TEST", "SEC"))
    ap.add_argument("--one", nargs=3, metavar=("CAM", "TEST", "SEC"))
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    if args.test:
        cam, test, sec = (_norm_id(x) for x in args.test)
        lrc, dt, dur, nl = process_one(cam, test, sec, write=False)
        print(f"### Cam{cam} Test{test} Section{sec}  infer={dt:.1f}s  audio={dur:.1f}s  lines={nl}")
        print(lrc[:1500])

    elif args.one:
        cam, test, sec = (_norm_id(x) for x in args.one)
        lrc, dt, dur, nl = process_one(cam, test, sec, write=True)
        print(f"WROTE Cam{cam} Test{test} Section{sec}  infer={dt:.1f}s  audio={dur:.1f}s  lines={nl}")
        print(lrc[:800])

    elif args.all:
        secs = all_sections()
        total = len(secs)
        start_t = time.time()
        done, errors = 0, []
        for (cam, test, sec) in secs:
            out = lrc_path(cam, test, sec)
            if os.path.exists(out):
                done += 1
                continue
            try:
                _, dt, dur, nl = process_one(cam, test, sec, write=True)
                print(f"[OK] Cam{cam} T{test} S{sec}  {dt:.1f}s  ({done+1}/{total})")
            except Exception as e:
                errors.append(f"Cam{cam}T{test}S{sec}:{type(e).__name__}")
                print(f"[ERR] Cam{cam} T{test} S{sec}: {e}")
            done += 1
            if done % 1 == 0:
                write_progress(done, total, start_t, errors)
        write_progress(total, total, start_t, errors)
        print(f"DONE. {total} sections, {len(errors)} errors.")

if __name__ == "__main__":
    main()
