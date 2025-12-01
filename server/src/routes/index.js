const createAuthRoutes = require('./auth');
const createFileRoutes = require('./files');
const createFolderRoutes = require('./folders');
const createTreeRoutes = require('./tree');
const createEntriesRoutes = require('./entries');
const createMetaRoutes = require('./meta');
const createSearchRoutes = require('./search');
const createShareRoutes = require('./shares');

module.exports = {
  createAuthRoutes,
  createFileRoutes,
  createFolderRoutes,
  createTreeRoutes,
  createEntriesRoutes,
  createMetaRoutes,
  createSearchRoutes,
  createShareRoutes,
};
