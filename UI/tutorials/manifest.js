/* ============================================================
   UI/tutorials/manifest.js  —  window.TUTORIALS_TREE

   Defines the Tutorials subsite's section tree. Each top-level
   section maps to a folder under Tutorials/ (e.g. Writing/). We
   currently ship Writing; add Speaking / Reading / Listening by
   dropping a folder under Tutorials/ and a matching entry here.

   Tree shape (section → group → sub-group → page, recursively):
     sections: [
       { id, name, folder, groups: [
         { name, items: [ { file, title? } ] }       // leaf group
         { name, groups: [ … ] }                     // parent group
       ]}
     ]

   • `file` paths are RELATIVE to Tutorials/index.html
     (so "Writing/Task2/Part1-主线题走通/主线题走通-从0到7.5.md").
   • `title` is optional: if omitted the app fetches the .md and uses
     its first H1 as the displayed title (falling back to the file name).
   • Nesting is recursive — a group may carry `items` (leaf) or
     `groups` (further nesting). The sidebar renders every level with
     indentation; prev/next walks the flattened page order.

   When you add a new section, just append an object to `sections` and
   list its groups/items. No other code change is (usually) required.
   ============================================================ */

window.TUTORIALS_TREE = {
  sections: [
    {
      id: "writing",
      name: "写作 Writing",
      folder: "Writing",
      groups: [
        {
          name: "大作文 Task 2",
          groups: [
            {
              name: "主线题走通",
              items: [
                { file: "Writing/Task2/Part1-主线题走通/主线题走通-从0到7.5.md" },
              ],
            },
            {
              name: "按题型",
              items: [
                { file: "Writing/Task2/Part2-摊开大饼/按题型/01-Agree-Disagree.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按题型/02-Discuss-Both-Views.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按题型/03-Advantages-Disadvantages.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按题型/04-Positive-Negative.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按题型/05-Two-part-Question.md" },
              ],
            },
            {
              name: "按话题",
              items: [
                { file: "Writing/Task2/Part2-摊开大饼/按话题/01-教育.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/02-科技媒体.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/03-社会政府.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/04-环境能源.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/05-工作经济.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/06-健康生活方式.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/07-犯罪法律.md" },
                { file: "Writing/Task2/Part2-摊开大饼/按话题/08-文化全球化.md" },
              ],
            },
          ],
        },
        {
          name: "小作文 Task 1",
          groups: [
            {
              name: "主线题走通",
              items: [
                { file: "Writing/Task1/Part1-线图走通/线图走通-从0到7.5.md" },
              ],
            },
            {
              name: "按图表类型",
              items: [
                { file: "Writing/Task1/Part2-摊开大饼/01-线图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/02-柱状图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/03-饼图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/04-表格.md" },
                { file: "Writing/Task1/Part2-摊开大饼/05-组合图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/06-地图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/07-流程图.md" },
                { file: "Writing/Task1/Part2-摊开大饼/08-F系列.md" },
              ],
            },
          ],
        },
        {
          name: "附录 Appendix",
          items: [
            { file: "Writing/Appendix/A-大作文通用句型骨架库.md" },
            { file: "Writing/Appendix/B-大作文跨话题高级词块.md" },
            { file: "Writing/Appendix/C-小作文趋势动词分层表.md" },
            { file: "Writing/Appendix/D-小作文万能句型骨架与衔接.md" },
          ],
        },
      ],
    },
  ],
};
