"use strict";

const {URL} = require("global/window");

const {
  STATUS_BLOCKED,
  STATUS_UNDEFINED
} = require("../../../common/constants");
const settings = require("../../../common/settings");
const db = require("../../database/json");

const PRESETS = require("../../../../data/domains");

let presets;
let authorDomains;
let videoDomains;

function setPresets(domains)
{
  presets = domains;
  authorDomains = new Set(domains.author);
  videoDomains = new Set(domains.video);
}

setPresets(PRESETS);

function refreshPresets()
{
  db.get("domains").then(({domains}) =>
  {
    if (!domains)
    {
      return;
    }

    setPresets(domains);
  });
}
exports.refreshPresets = refreshPresets;

// load any existing updates
settings.get("domains.lastUpdated", 0)
  .then((lastUpdated) =>
  {
    if (lastUpdated > 0)
    {
      refreshPresets();
    }
  });

function isAuthorDomain(domain)
{
  return authorDomains.has(domain);
}
exports.isAuthorDomain = isAuthorDomain;

function hasVideos(domain)
{
  return videoDomains.has(domain);
}
exports.hasVideos = hasVideos;

/**
 * Retrieve only tree nodes which are relevant to the given host
 * @param {string[]} hostParts - host parts (e.g. ["example", "com"])
 * @return {any[]} tree nodes corresponding to given host parts
 */
function filterTree(hostParts)
{
  let treeNodes = [];
  let tree = presets.status;

  for (let hostPart, i = hostParts.length - 1; hostPart = hostParts[i]; i--)
  {
    tree = tree[hostPart];
    if (typeof tree == "undefined")
      break;

    treeNodes.unshift(tree);
  }

  return treeNodes;
}

/**
 * Resolve flattr status for given domain or URL
 * @param {Object} options
 * @param {string} [options.domain]
 * @param {string} [options.url]
 * @return {number} flattr status
 */
function get({domain, url})
{
  // Determine what to search for
  let hostname = null;
  let pathname = null;
  if (url)
  {
    ({hostname, pathname} = new URL(url));
  }
  else if (domain)
  {
    hostname = domain;
  }
  else
    return STATUS_UNDEFINED;

  let hostParts = hostname.split(".");
  let treeNodes = filterTree(hostParts);

  // Does most specific tree node only define a status? In that case
  // we won't find anything more specific
  let treeNode = treeNodes[0];
  let value = treeNode;
  if (typeof value == "number")
    return value;

  // Check tree node which exactly matches given host
  if (treeNodes.length == hostParts.length)
  {
    // Does tree node define status of given path?
    if (pathname)
    {
      let [pathStart] = /^\/[^/]*/.exec(pathname);
      value = treeNode[pathStart];
      if (typeof value == "number")
        return value;
    }

    // Does tree node define a status for all paths?
    value = treeNode[""];
    if (typeof value == "number")
      return value;
  }

  // Check tree nodes from most to least specific
  for (treeNode of treeNodes)
  {
    // Does tree node define a status for host and its subdomains?
    value = treeNode["*"];
    if (typeof value == "number")
      return value;
  }

  // We couldn't find any status
  return STATUS_UNDEFINED;
}
exports.get = get;

exports.isBlocked = (url) => get(url) == STATUS_BLOCKED;
