/*
 * Vimari injected script.
 *
 * This script is called before the requested page is loaded.  This allows us
 * to intercept events before they are passed to the requested pages code and
 * therefore we can stop certain pages (google) stealing the focus.
 */


/*
 * Global vars
 *
 * topWindow        - true if top window, false if iframe
 * settings         - stores user settings
 * currentZoomLevel - required for vimium scripts to run correctly
 * linkHintCss      - required from vimium scripts
 * extensionActive  - is the extension currently enabled (should only be true when tab is active)
 * shiftKeyToggle   - is shift key currently toggled
 */

var topWindow = (window.top === window),
	settings = {},
	currentZoomLevel = 100,
	linkHintCss = {},
	extensionActive = true,
	insertMode = false,
	shiftKeyToggle = false,
	hudDuration = 5000;

var actionMap = {
	'hintToggle' : function() {
		HUD.showForDuration('Open link in current tab', hudDuration);
		activateLinkHintsMode(false, false); },

	'newTabHintToggle' : function() {
		HUD.showForDuration('Open link in new tab', hudDuration);
		activateLinkHintsMode(true, false); },

	'tabForward':
        function() { safari.extension.dispatchMessage("tabForward"); },

	'tabBack':
        function() { safari.extension.dispatchMessage("tabBackward"); },

	'scrollDown':
		function() { window.scrollBy(0, settings.scrollSize); },

	'scrollUp':
		function() { window.scrollBy(0, -settings.scrollSize); },

	'scrollLeft':
		function() { window.scrollBy(-settings.scrollSize, 0); },

	'scrollRight':
		function() { window.scrollBy(settings.scrollSize, 0); },

	'goBack':
		function() { window.history.back(); },

	'goForward':
		function() { window.history.forward(); },

	'reload':
		function() { window.location.reload(); },

	'openTab':
		function() { openNewTab(settings.tabPage); },

	'closeTab':
        function() { closeTab(); },
        
	'closeTabReverse':
		function() { safari.self.tab.dispatchMessage('closeTab', 1); },

	'scrollDownHalfPage':
		function() { window.scrollBy(0, window.innerHeight * 0.5 ); },

	'scrollUpHalfPage':
		function() { window.scrollBy(0, window.innerHeight * 0.5 ); },

	'goToPageBottom':
		function() { window.scrollBy(0, document.body.scrollHeight); },

	'goToPageTop':
		function() { window.scrollBy(0, -document.body.scrollHeight); }
};

// Meant to be overridden, but still has to be copy/pasted from the original...
Mousetrap.stopCallback = function(e, element, combo) {
	// Escape key is special, no need to stop. Vimari-specific.
	if (combo === 'esc' || combo === 'ctrl+[') { return false; }

  // Preserve the behavior of allowing ex. ctrl-j in an input
  if (settings.modifier) { return false; }

	// if the element has the class "mousetrap" then no need to stop
	if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
		return false;
	}

    var tagName = element.tagName;
    var contentIsEditable = (element.contentEditable && element.contentEditable === 'true');

    // stop for input, select, and textarea
    return tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || contentIsEditable;
};

// Set up key codes to event handlers
function bindKeyCodesToActions() {
	// Only add if topWindow... not iframe
	if (topWindow && !isExcludedUrl(settings.excludedUrls, document.URL)) {
		Mousetrap.reset();
		Mousetrap.bind('esc', enterNormalMode);
		Mousetrap.bind('ctrl+[', enterNormalMode);
		Mousetrap.bind('i', enterInsertMode);
		for (var actionName in actionMap) {
			if (actionMap.hasOwnProperty(actionName)) {
				var keyCode = getKeyCode(actionName);
				Mousetrap.bind(keyCode, executeAction(actionName), 'keydown');
			}
		}
	}
}

function enterNormalMode() {
	// Clear input focus
	document.activeElement.blur();

	// Clear link hints (if any)
	deactivateLinkHintsMode();

	// Re-enable if in insert mode
	insertMode = false;
	Mousetrap.bind('i', enterInsertMode);
}

// Calling it 'insert mode', but it's really just a user-triggered
// off switch for the actions.
function enterInsertMode() {
	insertMode = true;
	Mousetrap.unbind('i');
}

function executeAction(actionName) {
	return function() {
		// don't do anything if we're not supposed to
		if (linkHintsModeActivated || !extensionActive || insertMode)
			return;

		//Call the action function
		actionMap[actionName]();

		// Tell mousetrap to stop propagation
		return false;
	}
}

function unbindKeyCodes() {
	Mousetrap.reset();
}

// Adds an optional modifier to the configured key code for the action
function getKeyCode(actionName) {
	var keyCode = '';
	if(settings.modifier) {
		keyCode += settings.modifier + '+';
	}
	return keyCode + settings[actionName];
}


/*
 * Adds the given CSS to the page.
 * This function is required by vimium but depracated for vimari as the
 * css is pre loaded into the page.
 */
function addCssToPage(css) {
	return;
}


/*
 * Input or text elements are considered focusable and able to receive their own keyboard events,
 * and will enter enter mode if focused. Also note that the "contentEditable" attribute can be set on
 * any element which makes it a rich text editor, like the notes on jjot.com.
 * Note: we used to discriminate for text-only inputs, but this is not accurate since all input fields
 * can be controlled via the keyboard, particularly SELECT combo boxes.
 */
function isEditable(target) {
	if (target.getAttribute("contentEditable") === "true")
		return true;
	var focusableInputs = ["input", "textarea", "select", "button"];
	return focusableInputs.indexOf(target.tagName.toLowerCase()) >= 0;
}


/*
 * Embedded elements like Flash and quicktime players can obtain focus but cannot be programmatically
 * unfocused.
 */
function isEmbed(element) { return ["EMBED", "OBJECT"].indexOf(element.tagName) > 0; }


// ==========================
// Message handling functions
// ==========================

/*
 * All messages are handled by this function
 */
function handleMessage(msg) {
	// Attempt to call a function with the same name as the message name
	switch(msg.name) {
		case 'setSettings':
			setSettings(msg.message);
			break;
		case 'setActive':
			setActive(msg.message);
			break;
	}
}

/*
 * Callback to pass settings to injected script
 */
function setSettings(msg) {
	settings = msg;
	bindKeyCodesToActions();
}

/*
 * Enable or disable the extension on this tab
 */
function setActive(msg) {
	extensionActive = msg;
	if(msg) {
		bindKeyCodesToActions();
	} else {
		unbindKeyCodes();
	}
}

function isExcludedUrl(storedExcludedUrls, currentUrl) {
	if (!storedExcludedUrls.length) {
		return false;
	}

    var excludedUrls, regexp, url, formattedUrl, _i, _len;
    excludedUrls = storedExcludedUrls.split(",");
    for (_i = 0, _len = excludedUrls.length; _i < _len; _i++) {
        url = excludedUrls[_i];
        formattedUrl = stripProtocolAndWww(url);
        formattedUrl = formattedUrl.toLowerCase();
        regexp = new RegExp('((.*)?(' + formattedUrl + ')+(.*))');
        if (currentUrl.toLowerCase().match(regexp)) {
            return true;
        }
    }
    return false;
}

function openNewTab(url="favorites:///") {
  console.log(`-- Open new tab at ${url} --`);
  window.open(url, url);
  //safari.extension.dispatchMessage("openNewTab");
}

function closeTab() {
    window.close()
    console.log("closing tab")
}


// These formations removes the protocol and www so that
// the regexp can catch less AND more specific excluded
// domains than the current URL.
function stripProtocolAndWww(url) {
  url = url.replace('http://', '');
  url = url.replace('https://', '');
  if (url.startsWith('www.')) {
      url = url.slice(4);
  }

  return url;
}

// Bootstrap extension
setSettings(window.getSettings());
// Add event listener
// safari.self.addEventListener("message", handleMessage, false);
// Retrieve settings
// safari.self.tab.dispatchMessage('getSettings', '');

// Export to make it testable
window.isExcludedUrl = isExcludedUrl;
window.stripProtocolAndWww = stripProtocolAndWww;
