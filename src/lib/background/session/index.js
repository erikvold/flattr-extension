"use strict";

const {on} = require("../../common/events");
const audio = require("./audio");
const attention = require("./attention");
const storage = require("./storage");

on("data", ({tabId, action, data}) =>
{
  switch (action)
  {
    case "audible":
    case "muted":
      let tabPage = storage.getPage(tabId);
      if (!tabPage)
        return;

      let wasAudible = audio.isAudible(tabPage);
      audio.update(tabId, action, data);
      let isAudible = audio.isAudible(tabPage);

      // Start gathering attention immediately when audio starts playing
      if (!wasAudible && isAudible)
        return attention.start(tabId, {background: true});

      // Stop gathering attention immediately when audio stops playing
      if (wasAudible && !isAudible)
        return attention.stop(tabId, {background: true});

      return;
    case "audible-ongoing":
      return attention.start(tabId, {background: true});
    case "idle":
      switch (data)
      {
        case "active":
          return attention.start(tabId);
        case "idle":
        case "locked":
          return attention.stop(tabId);
      }
      return;
    case "page-loaded":
      if (data >= 200 && data < 300)
        return attention.start(tabId);

      // Redirects should not be treated as errors so we need to return here
      if (data >= 300 && data < 400)
        return;

      // fall through
    case "removed":
      audio.reset(tabId);
      return attention.stop(tabId).then(() => storage.removePage(tabId));
    case "selected":
      attention.select(tabId);
      return attention.start(tabId);
    case "selected-initial":
      attention.select(tabId);
      return;
    case "state":
      let {title, url} = data;
      if (!url)
        return storage.removePage(tabId);

      return storage.updatePage(tabId, {title, url});
    case "title":
      return storage.updatePage(tabId, {title: data});
    case "url":
      audio.reset(tabId);
      return storage.updatePage(tabId, {url: data});
    case "keypressed":
    case "pointerclicked":
    case "pointermoved":
    case "scrolled-end":
    case "scrolled-ongoing":
    case "scrolled-start":
    case "zoom":
      return attention.start(tabId);
    case "user-flattr-added":
      return attention.interrupt(tabId).then(() => storage.fastForward(tabId));
  }
});
