var taboo;

(function() { // keep our privates to ourselves

var $ = function $(id) { return document.getElementById(id); };
var log = function log(msg) {}; // maybe overridden in init
var debug = false;
var prefs;

function currentUrl() {
  return gBrowser.selectedBrowser.webNavigation.currentURI.spec.replace(/#.*/, '');
}

function Taboo() {
  const SVC = Cc['@oy/taboo;1'].getService(Ci.oyITaboo);

  const START_URL = 'chrome://taboo/content/start.html';

  function saved(state) {
    if ($('taboo-toolbarbutton-add')) {
      if (state) {
        $('taboo-toolbarbutton-add').setAttribute('saved', true);
      }
      else {
        $('taboo-toolbarbutton-add').removeAttribute('saved');
      }
    }
  }

  this.focusDetails = function() {
    document.getElementById('taboo-notes').focus();
  };

  function editDetails(url) {
    url = url || currentUrl();

    var tab = SVC.getForURL(url);

    var panel = document.getElementById('taboo-details');

    document.getElementById('taboo-image').setAttribute('src', tab.thumbURL);
    document.getElementById('taboo-title').value = (tab.title || '');
    document.getElementById('taboo-notes').value = (tab.description || '');

    // FIXME: where should this be positioned???
    panel.openPopup(document.getElementById('taboo-toolbarbutton-add'), 'after_start', -1, -1);
    panel.focus();
  };

  this.panelDelete = function() {
    SVC.delete(currentUrl());
    saved(false);
    document.getElementById('taboo-details').hidePopup();
  };

  this.panelUpdate = function() {
    var title = document.getElementById('taboo-title').value;
    var notes = document.getElementById('taboo-notes').value;
    SVC.update(currentUrl(), title, notes);
    document.getElementById('taboo-details').hidePopup();
  };

  this.gotoRecent = function(targetNode, event) {
    event.preventDefault();
    event.stopPropagation();
    SVC.open(targetNode.getAttribute('url'), 'tabforeground');
  };

  this.showRecentList = function(domId) {
    var popup = $(domId);
    while (popup.firstChild) {
      popup.removeChild(popup.firstChild);
    };

    function addRecent(tab) {
      var item = document.createElement('menuitem');
      item.setAttribute('class', 'menuitem-iconic');
      item.setAttribute('label', tab.title);
      item.setAttribute('oncommand', 'taboo.gotoRecent(this, event);');
      item.setAttribute('url', tab.url);
      item.setAttribute('image', tab.favicon);
      item.setAttribute('tooltiptext', tab.url);
      popup.appendChild(item);
    }

    var taboos = SVC.getRecent(15);

    if (taboos.hasMoreElements()) {
      while (taboos.hasMoreElements()) {
        var tab = taboos.getNext();
        tab.QueryInterface(Components.interfaces.oyITabooInfo);
        addRecent(tab);
      }
    }
    else {
      var item = document.createElement('menuitem');
      item.setAttribute('label', 'No Tabs Saved');
      item.setAttribute('disabled', true);
      popup.appendChild(item);
    }
  };

  this.toggleTaboo = function(event) {
    var url = currentUrl();

    if (SVC.isSaved(url)) {
      SVC.delete(url);
      saved(false);
    } else {
      SVC.save(null);
      saved(true);
    }
  };

  this.addTaboo = function(event) {
    SVC.save(null);
    saved(true);
    editDetails();
  };

  this.addTabooAndClose = function(event) {
    SVC.save(null);
    saved(true);

    var url = currentUrl();
    if (SVC.isSaved(url)) {
      BrowserCloseTabOrWindow();
    }
  };

  this.removeTaboo = function(event) {
    var url = currentUrl();
    SVC.delete(url);
    saved(false);
  };

  this.show = function(event) {
    var tab = getTabIdxForUrl(START_URL);
    if (tab !== null) {
      gBrowser.mTabContainer.selectedIndex = tab;
      return;
    }

    var url = gBrowser.selectedBrowser.webNavigation.currentURI.spec;
    if (event.shiftKey ||
        url == 'about:blank') {
      openUILinkIn(START_URL, 'current');
      return;
    }

    openUILinkIn(START_URL, 'tab');
  };

  var quickShowRows = document.getElementById('tabs-rows');

  var quickShowEnum;
  var quickShowTabs = [];
  var quickShowIdx = 0;

  var displayCols = 4;
  var displayRows = 3;
  var topRow = 0;

  function visible(idx) {
    if (idx < 0 || idx >= quickShowTabs.length) {
      return false;
    }

    return quickShowTabs[idx].parentNode.style.display != 'none';
  }

  function setVisibleFor(idx, visible) {
    if (idx >= 0 || idx < quickShowTabs.length) {
      var display = visible ? '' : 'none';
      quickShowTabs[idx].parentNode.style.display = display;
    }
  }

  function moveTo(newIdx) {
    if (newIdx < 0) {
      return;
    }

    if (newIdx >= quickShowTabs.length) {
      if (quickShowEnum.hasMoreElements()) {
        addRow();
      }
      else {
        return;
      }
    }

    quickShowTabs[quickShowIdx].removeAttribute('id');
    quickShowIdx = newIdx;
    quickShowTabs[quickShowIdx].setAttribute('id', 'currentTaboo');

    if (!visible(quickShowIdx)) {
      setVisibleFor(quickShowIdx, true);
    }

    var topIdx = quickShowIdx - (displayRows * displayCols);

    if (visible(topIdx)) {
      setVisibleFor(topIdx, false);
    }

    var bottomIdx = quickShowIdx + (displayRows * displayCols);
    if (visible(bottomIdx)) {
      setVisibleFor(bottomIdx, false);
    }
  }

  function addQuickViewItem(tab, row) {
    var item = document.createElement('image');
    item.setAttribute('src', tab.thumbURL);
    item.setAttribute('title', tab.title);
    item.setAttribute('url', tab.url);
    item.setAttribute('tooltiptext', tab.url);

    row.appendChild(item);
    item.onclick = function(event) {
      taboo.gotoRecent(this, event);
      panel.hidePopup();
    };

    return item;
  }

  function addRow() {
    var col = 0;
    var row = document.createElement('row');
    while (col < displayCols && quickShowEnum.hasMoreElements()) {
      var tab = quickShowEnum.getNext();
      tab.QueryInterface(Components.interfaces.oyITabooInfo);
      var item = addQuickViewItem(tab, row);
      quickShowTabs.push(item);
      col++;
    }
    quickShowRows.appendChild(row);
  }

  var quickShowListener = function(event) {
    var current = quickShowTabs[quickShowIdx];
    switch (event.keyCode) {

    case event.DOM_VK_RETURN:
      var url = current.getAttribute('url');
      document.getElementById('taboo-quickShow').hidePopup();
      SVC.open(current.getAttribute('url'), 'current');
      break;
    case event.DOM_VK_LEFT:
      moveTo(quickShowIdx-1);
      break;
    case event.DOM_VK_RIGHT:
      moveTo(quickShowIdx+1);
      break;
    case event.DOM_VK_UP:
      moveTo(quickShowIdx-displayCols);
      break;
    case event.DOM_VK_DOWN:
      moveTo(quickShowIdx+displayCols);
      break;
    default:
      return;
    }

    event.stopPropogation();
  };

  this.hideQuickShow = function() {
    window.removeEventListener('keypress', quickShowListener, true);
    quickShowTabs = [];
    quickShowIdx = 0;
    quickShowEnum = null;

    while (quickShowRows.firstChild) {
      quickShowRows.removeChild(quickShowRows.firstChild);
    }
  };

  this.focusQuickShow = function() {
    window.addEventListener('keypress', quickShowListener, true);
  };

  this.showPanel = function(event) {
    // FIXME: on showing the popup we should move keyboard focus to this, and
    // using the cursors selects a taboo then return loads it.

    var panel = document.getElementById('taboo-quickShow');
    var groupbox = document.getElementById('taboo-groupbox');
    var grid = document.getElementById('taboo-grid');

    //  groupbox.style.maxHeight = (numRows * 150) + 'px';

    var columns = document.createElement('columns');

    for (var i = 0; i < displayCols; i++) {
      var col = document.createElement('column');
      col.setAttribute('flex', '1');
      columns.appendChild(col);
    }

    quickShowEnum = SVC.get('', false);

    if (quickShowEnum.hasMoreElements()) {
      var rows = 0;
      while (rows < displayRows &&
             quickShowEnum.hasMoreElements()) {
        rows++;
        addRow();
      }
      moveTo(0);
    }
    else {
      var row = document.createElement('row');
      var item = document.createElement('label');
      item.setAttribute('value', 'No Tabs Saved');
      row.appendChild(item);
      quickShowRows.appendChild(row);
    }

    panel.openPopup(document.getElementById('taboo-toolbarbutton-add'), 'after_start', 100, 0, false, false);
    panel.focus();
  };

  this.quickShow = function(event) {
    // FIXME: on showing the popup we should move keyboard focus to this, and
    // using the cursors selects a taboo then return loads it.

    // FIXME: some of this code should be combined with showRecentList since
    // they are almost identical.. this is a hack-and-paste just to
    // learn how panel worsk

    var panel = document.getElementById('taboo-panel');
    var box = document.getElementById('tabs-box');

    while (box.firstChild) {
      box.removeChild(box.firstChild);
    };

    function addRecent(tab) {
      var item = document.createElement('image');
      item.setAttribute('src', tab.thumbURL);
      item.setAttribute('title', tab.title);
      item.setAttribute('url', tab.url);
      item.setAttribute('tooltiptext', tab.url);
      box.appendChild(item);
      item.onclick = function(event) {
        taboo.gotoRecent(this, event);
        panel.hidePopup();
      }
    }

    var taboos = SVC.getRecent(5);

    if (taboos.hasMoreElements()) {
      while (taboos.hasMoreElements()) {
        var tab = taboos.getNext();
        tab.QueryInterface(Components.interfaces.oyITabooInfo);
        addRecent(tab);
      }
    }
    else {
      var item = document.createElement('label');
      item.setAttribute('value', 'No Tabs Saved');
      box.appendChild(item);
    }

    // FIXME - the positioning of the panel is "random" - eg I did something that seems
    // to work on my browser, but no thought behind any of the parameters
    panel.openPopup(document.getElementById('taboo-toolbarbutton-add'), 'after_start', 100, 0, false, false);
  }

  this.updateButton = function(url) {
    if (url && SVC.isSaved(url)) {
      saved(true);
    }
    else {
      saved(false);
    }
  };
}

function init() {
  if (debug) {
    if ("undefined" != typeof console) {
      log = console.log;
    } else {
      var t = Cc['@mozilla.org/consoleservice;1'].
        getService(Ci.nsIConsoleService);
      log = function log(x) { t.logStringMessage(x); };
    }
  }

  prefs = Cc['@mozilla.org/preferences-service;1'].
    getService(Ci.nsIPrefService).getBranch('extensions.taboo.');

  taboo = new Taboo();

  installInToolbar();
  updateKeybindings();

  gBrowser.addProgressListener(progressListener,
                               Ci.nsIWebProgress.NOTIFY_LOCATION);
}

function uninit() {
  gBrowser.removeProgressListener(progressListener);
}

window.addEventListener("load", init, false);
window.addEventListener("unload", uninit, false);

function nop() {}

var progressListener = {
  last: 'none',
  onLocationChange: function(aWebProgress, aRequest, aLocation) {
    var url;
    try {
      url = aLocation.spec.replace(/#.*/, '');
    } catch (e) {}
    if (url != this.last) {
      taboo.updateButton(url);
      this.last = url;
    }
  },
  onStateChange: nop,
  onStatusChange: nop,
  onProgressChange: nop,
  onSecurityChange: nop,
};

// Check whether we installed the toolbar button already and install if not
function installInToolbar() {
  var addid = "taboo-toolbarbutton-add";
  var viewid = "taboo-toolbarbutton-view";
  if (prefs.getPrefType("setup") || $(addid))
    return; // exit early -- already installed

  var before = $("urlbar-container");
  var toolbar = $("nav-bar");
  if (toolbar && "function" == typeof toolbar.insertItem) {
    if (before && before.parentNode != toolbar)
      before = null;

    toolbar.insertItem(addid, before, null, false);
    toolbar.insertItem(viewid, before, null, false);

    toolbar.setAttribute("currentset", toolbar.currentSet);
    document.persist(toolbar.id, "currentset");
  }

  prefs.setBoolPref("setup", true); // Done! Never do this again.
}

function updateKeybindings() {

  function update(key_id, attribute) {
    try {
      if (prefs.getPrefType(key_id + '.' + attribute)) {
        var val = prefs.getCharPref(key_id + '.' + attribute);
        if (val && val.length > 0) {
          var binding = document.getElementById(key_id);
          binding.setAttribute(attribute, val);
        }
      }
    } catch (e) {}
  }

  ["key_showTaboos", "key_addTaboo", "key_addTabooAndClose", "key_removeTaboo"].forEach(function(key_id) {
    update(key_id, 'key');
    update(key_id, 'modifiers');
  });
}

function getTabIdxForUrl(aURL) {
  var num = gBrowser.browsers.length;
  for (var i = 0; i < num; i++) {
    var b = gBrowser.getBrowserAtIndex(i);
    try {
      if (b.currentURI.spec == aURL) {
        return i;
      }
    } catch(e) {
      // can't get the URL?
    }
  }
  return null;
}

})();
