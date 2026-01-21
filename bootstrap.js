var notifierID = null;
var PREF_BRANCH = 'extensions.autohjfy.';
var windowListener = null;

var Observer = {
  notify: async function (event, type, ids, extraData) {
    if (event !== 'add' || type !== 'item') {
      return;
    }

    try {
      await handleNewItems(ids);
    } catch (e) {
      Zotero.logError(e);
    }
  }
};

async function startup(data, reason) {
  ensureDefaultPrefs();
  notifierID = Zotero.Notifier.registerObserver(Observer, ['item']);
  registerWindowUI();
}

function shutdown(data, reason) {
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
    notifierID = null;
  }
  unregisterWindowUI();
}

function install(data, reason) {
  // No-op.
}

function uninstall(data, reason) {
  // No-op.
}

async function handleNewItems(ids) {
  return;
}

function getArxivId(item) {
  let url = item.getField('url') || '';
  let match = url.match(/arxiv\.org\/abs\/([^?#]+)/i);
  if (match && match[1]) {
    return normalizeArxivId(match[1]);
  }

  match = url.match(/arxiv\.org\/pdf\/([^?#]+)(?:\.pdf)?/i);
  if (match && match[1]) {
    return normalizeArxivId(match[1]);
  }

  let extra = item.getField('extra') || '';
  match = extra.match(/arXiv:\s*([^\s]+)/i);
  if (match && match[1]) {
    return normalizeArxivId(match[1]);
  }

  match = extra.match(/arxiv\.org\/abs\/([^?#]+)/i);
  if (match && match[1]) {
    return normalizeArxivId(match[1]);
  }

  let doi = item.getField('doi') || '';
  match = doi.match(/arXiv:\s*([^\s]+)/i);
  if (match && match[1]) {
    return normalizeArxivId(match[1]);
  }

  return null;
}

async function hasTranslationAttachment(item, attachmentTitle) {
  let attachmentIDs = item.getAttachments();
  if (!attachmentIDs || !attachmentIDs.length) {
    return false;
  }

  let attachments = await Zotero.Items.getAsync(attachmentIDs);
  return attachments.some(att => att && att.getField('title') === attachmentTitle);
}

async function addTranslationForItems(items, attachmentTitle, force, window) {
  if (!force && !getPref('enabled', true)) {
    return;
  }

  let result = {
    foundArxiv: 0,
    added: 0,
    skippedExisting: 0,
    skippedNoArxiv: 0,
    failed: 0
  };

  for (let item of items) {
    if (!item || !item.isRegularItem()) {
      continue;
    }

    let arxivId = await getArxivIdFromItemOrAttachments(item);
    if (!arxivId) {
      result.skippedNoArxiv++;
      continue;
    }

    result.foundArxiv++;
    if (await hasTranslationAttachment(item, attachmentTitle)) {
      result.skippedExisting++;
      continue;
    }

    let url = 'https://hjfy.top/arxiv/' + arxivId;
    try {
      Zotero.debug('[autohjfy] Importing HJFY from ' + url + ' for item ' + item.id);
      await Zotero.Attachments.importFromURL({
        url: url,
        parentItemID: item.id,
        title: attachmentTitle,
        contentType: 'application/pdf'
      });
      result.added++;
    } catch (e) {
      result.failed++;
      Zotero.logError(e);
    }
  }

  if (force && window) {
    showManualResult(window, result);
  }

  return result;
}

async function getArxivIdFromItemOrAttachments(item) {
  let arxivId = getArxivId(item);
  if (arxivId) {
    return arxivId;
  }

  let attachmentIDs = item.getAttachments();
  if (!attachmentIDs || !attachmentIDs.length) {
    return null;
  }

  let attachments = await Zotero.Items.getAsync(attachmentIDs);
  for (let att of attachments) {
    if (!att) {
      continue;
    }

    arxivId = getArxivId(att);
    if (arxivId) {
      return arxivId;
    }
  }

  return null;
}

function normalizeArxivId(value) {
  if (!value) {
    return null;
  }

  let id = String(value).trim();
  id = id.replace(/^arXiv:\s*/i, '');

  let match = id.match(/arxiv\.org\/abs\/([^?#]+)/i);
  if (match && match[1]) {
    id = match[1];
  }

  match = id.match(/arxiv\.org\/pdf\/([^?#]+)(?:\.pdf)?/i);
  if (match && match[1]) {
    id = match[1];
  }

  id = id.replace(/\.pdf$/i, '');
  if (!id) {
    return null;
  }

  if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(id) || /^[a-z-]+\/\d{7}(v\d+)?$/i.test(id)) {
    return id;
  }

  return null;
}

async function normalizeItems(items) {
  let normalized = [];
  let seen = new Set();
  for (let item of items) {
    if (!item) {
      continue;
    }

    if (item.isAttachment()) {
      let parentID = item.parentItemID;
      if (parentID) {
        let parent = Zotero.Items.get(parentID);
        if (parent && !seen.has(parent.id)) {
          normalized.push(parent);
          seen.add(parent.id);
        }
      }
      continue;
    }

    if (item.isRegularItem() && !seen.has(item.id)) {
      normalized.push(item);
      seen.add(item.id);
    }
  }

  return normalized;
}

function ensureDefaultPrefs() {
  ensurePref('enabled', true);
  ensurePref('attachmentTitle', 'HJFY Translation');
  ensurePref('deleteSourceFile', true);
}

function ensurePref(key, value) {
  let prefKey = PREF_BRANCH + key;
  try {
    let current = Zotero.Prefs.get(prefKey);
    if (current === undefined || current === null || current === '') {
      Zotero.Prefs.set(prefKey, value);
    }
  } catch (e) {
    Zotero.Prefs.set(prefKey, value);
  }
}

function getPref(key, fallback) {
  let prefKey = PREF_BRANCH + key;
  try {
    let value = Zotero.Prefs.get(prefKey);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return value;
  } catch (e) {
    return fallback;
  }
}

function registerWindowUI() {
  let mainWindow = Zotero.getMainWindow();
  if (mainWindow) {
    addUIToWindow(mainWindow);
  }

  windowListener = {
    onOpenWindow: function (xulWindow) {
      let domWindow = xulWindow.docShell.domWindow;
      domWindow.addEventListener('load', function onLoad() {
        domWindow.removeEventListener('load', onLoad, false);
        if (domWindow.Zotero) {
          addUIToWindow(domWindow);
        }
      }, false);
    },
    onCloseWindow: function () {},
    onWindowTitleChange: function () {}
  };

  try {
    const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
    Services.wm.addListener(windowListener);
  } catch (e) {
    Zotero.logError(e);
  }
}

function unregisterWindowUI() {
  try {
    const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
    if (windowListener) {
      Services.wm.removeListener(windowListener);
      windowListener = null;
    }
  } catch (e) {
    Zotero.logError(e);
  }

  let mainWindow = Zotero.getMainWindow();
  if (mainWindow) {
    removeUIFromWindow(mainWindow);
  }
}

function addUIToWindow(window) {
  let doc = window.document;

  let itemMenu = doc.getElementById('zotero-itemmenu');
  if (itemMenu && !doc.getElementById('autohjfy-itemmenu')) {
    let menuitem = doc.createXULElement('menuitem');
    menuitem.id = 'autohjfy-itemmenu';
    menuitem.setAttribute('label', 'Add HJFY Translation');
    menuitem.addEventListener('command', function () {
      addTranslationFromSelection(window);
    });
    itemMenu.appendChild(menuitem);
  }
}

function removeUIFromWindow(window) {
  let doc = window.document;
  let itemMenu = doc.getElementById('autohjfy-itemmenu');
  if (itemMenu && itemMenu.parentNode) {
    itemMenu.parentNode.removeChild(itemMenu);
  }
}

async function addTranslationFromSelection(window) {
  try {
    let zoteroPane = window.Zotero.getActiveZoteroPane();
    let items = zoteroPane.getSelectedItems();
    if (!items || !items.length) {
      return;
    }

    let attachmentTitle = getPref('attachmentTitle', 'HJFY Translation');
    items = await normalizeItems(items);
    if (items.length !== 1) {
      Zotero.alert(window, 'autohjfy', '请只选择一个条目再执行该操作。');
      return;
    }

    await addTranslationWithFilePicker(items[0], window, attachmentTitle, true, true);
  } catch (e) {
    Zotero.logError(e);
  }
}

function showManualResult(window, result) {
  let title = 'autohjfy';
  if (result.foundArxiv === 0) {
    Zotero.alert(window, title, '未找到可用的 arXiv 网址或编号。');
    return;
  }

  if (result.added > 0) {
    Zotero.alert(window, title, '已添加翻译附件：' + result.added + ' 个。');
    return;
  }

  if (result.skippedExisting > 0) {
    Zotero.alert(window, title, '已存在翻译附件，无需重复添加。');
    return;
  }

  if (result.failed > 0) {
    Zotero.alert(window, title, '添加失败，请查看 Debug 日志。');
  }
}


async function addTranslationWithFilePicker(item, window, attachmentTitle, openUrl, showAlerts) {
  if (!item || !item.isRegularItem()) {
    return false;
  }

  if (await hasTranslationAttachment(item, attachmentTitle)) {
    if (showAlerts) {
      Zotero.alert(window, 'autohjfy', '已存在翻译附件，无需重复添加。');
    }
    return false;
  }

  let arxivId = await getArxivIdFromItemOrAttachments(item);
  if (!arxivId) {
    if (showAlerts) {
      Zotero.alert(window, 'autohjfy', '未找到可用的 arXiv 网址或编号。');
    }
    return false;
  }

  let url = 'https://hjfy.top/arxiv/' + arxivId;
  if (openUrl) {
    try {
      Zotero.launchURL(url);
    } catch (e) {
      Zotero.logError(e);
    }
  }

  let filePath = await pickPdfFile(window);
  if (!filePath) {
    return false;
  }

  try {
    await Zotero.Attachments.importFromFile({
      file: filePath,
      parentItemID: item.id,
      title: attachmentTitle,
      contentType: 'application/pdf'
    });
    removeSourceFile(filePath);
    if (showAlerts) {
      Zotero.alert(window, 'autohjfy', '已添加翻译附件。');
    }
    return true;
  } catch (e) {
    Zotero.logError(e);
    if (showAlerts) {
      Zotero.alert(window, 'autohjfy', '添加失败，请查看 Debug 日志。');
    }
    return false;
  }
}

function pickPdfFile(window) {
  return new Promise(resolve => {
    try {
      let fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
      fp.init(window, '选择翻译 PDF 文件', Ci.nsIFilePicker.modeOpen);
      fp.appendFilter('PDF', '*.pdf');
      fp.appendFilters(Ci.nsIFilePicker.filterAll);

      if (fp.open) {
        fp.open(result => {
          if (result === Ci.nsIFilePicker.returnCancel) {
            resolve(null);
            return;
          }
          resolve(fp.file ? fp.file.path : null);
        });
      } else {
        let result = fp.show();
        if (result === Ci.nsIFilePicker.returnCancel) {
          resolve(null);
          return;
        }
        resolve(fp.file ? fp.file.path : null);
      }
    } catch (e) {
      Zotero.logError(e);
      resolve(null);
    }
  });
}

function removeSourceFile(filePath) {
  try {
    let file = Zotero.File.pathToFile(filePath);
    if (file && file.exists()) {
      file.remove(false);
    }
  } catch (e) {
    Zotero.logError(e);
  }
}
