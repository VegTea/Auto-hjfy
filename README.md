# autohjfy

为 Zotero 7 提供 arXiv 论文的 HJFY 翻译附件添加功能。

[幻觉翻译](https://hjfy.top/)

## 功能
- 右键条目提供 “Add HJFY Translation”，会打开对应 HJFY 页面并弹出文件选择框，选择已下载的 PDF 后挂载为附件。
- 成功导入附件（翻译后的PDF）之后插件会自动删除刚刚下载的PDF。

## 安装
1. 打包扩展：
   ```bash
   bash /home/haocheng/Workspace/zotero_plugin/build.sh
   ```
2. Zotero 7 → 工具 → 插件 → Manage Your Plugins → Install Plugin From File...  
3. 选择 `autohjfy.xpi` 并重启 Zotero

## 使用

1. 选中单个条目，右键 → “Add HJFY Translation”
2. 浏览器打开对应 `https://hjfy.top/arxiv/{arxivId}` 页面
3. 在浏览器**手动点击**下载翻译 PDF
4. 插件弹出文件选择框，选择刚下载的 PDF
5. PDF 会作为附件挂载到当前条目
6. 下载的 PDF 被自动删除

## 设置
当前版本不提供可视化设置，使用默认行为（成功附加后自动删除源 PDF 文件）。

## 常见问题
### 为什么没有自动下载？
HJFY 需要登录，Zotero 的隐藏浏览器无法完成登录流程，也查找不到直链下载，因此改为“打开网页 + 手动下载 + 选择本地 PDF”的流程。

### 为什么点击"Add HJFY Translation"之后很久都没有弹出来网站？
如果你要添加的文章 HJFY 没有缓存，那么 HJFY 会翻译好再弹出网站，需要等待网站翻译完成。

### 为什么提示“未找到 arXiv 网址或编号”？
请确认条目 URL/Extra 中包含 arXiv 信息，或先用 Zotero 的浏览器插件正确导入 arXiv 条目。
