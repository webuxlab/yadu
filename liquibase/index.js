const path = require('path');
const colors = require('colors');
const { generateMainFile } = require('./src/main');
// Load env. variables from .env.NODE_ENV file.
require('dotenv').config({
  path: path.resolve(process.cwd(), process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env'),
});

const { logDebug } = require('../globals/utils');
const { createMigration, deployMigration } = require('./src/migration');
const { createVersion } = require('./src/version');
const { sync } = require('./src/sync');
const { diff } = require('./src/diff');
const { clearCheckSums } = require('./src/clear');
const { rollback } = require('./src/rollback');
const { Validation, CheckBasePath } = require('./lib/validation');

colors.setTheme({
  warn: 'yellow',
  error: 'red',
  debug: 'grey',
  info: 'blue',
  success: ['green'],
  action: 'cyan',
});

// ---

const { NODE_ENV } = process.env;

const basePath = process.env.BASE_PATH || path.join('.', 'mysql', 'changelog') + path.sep;
const classPath = process.env.CLASS_PATH || `${path.join(__dirname, 'lib')}${path.sep}mysql-connector-java-8.0.24.jar`;
// ERRATA : On windows You must use git bash or WSL
const liquibaseBasePath = process.env.LIQUIBASE_BASE_PATH || `${path.join(__dirname, 'lib', 'liquibase-4.3.5')}${path.sep}liquibase`;
const liquibaseConfPath = process.env.LIQUIBASE_CONF_PATH || `${path.join('.')}${path.sep}liquibase.properties`;

// DEBUGGING
logDebug(basePath);
logDebug(liquibaseBasePath);
logDebug(liquibaseConfPath);
logDebug(classPath);

// ---

async function Handler(args) {
  let handled = false;
  logDebug(args);
  const dryrun = !!args['dry-run'];
  process.env.dryrun = dryrun;

  if (!Validation(args)) {
    return false;
  }

  if (!CheckBasePath(basePath)) {
    return Promise.resolve(false);
  }

  // This one doesn't required to have access to the actual database
  if (args['create-migration'] && args.name) {
    console.log('Create new migration'.action);
    console.log('>>>');
    createMigration(args.name, basePath);
    console.log('<<<');
    handled = true;
  }

  // The following commands require a database configuration.
  if (!handled) {
    return Promise.resolve(false);
  }

  if (args['generate-main']) {
    console.log('Generate main.xml File'.action);
    console.log('>>>');
    await generateMainFile(liquibaseBasePath, liquibaseConfPath, basePath, classPath);
    console.log('<<<');
    handled = true;
  }

  if (args['deploy-migration'] && args.name) {
    const env = args.env || NODE_ENV || null;
    if (!env) {
      throw new Error("Missing '--env' or 'NODE_ENV'");
    }
    console.log(`Deploy migration ${args.name}`.action);
    console.log('>>>');
    deployMigration(args.name, env, liquibaseBasePath, liquibaseConfPath, basePath, classPath, dryrun);
    console.log('<<<');
    handled = true;
  }

  if (args.sync) {
    console.log('Deploy all available migrations'.action);
    console.log('>>>');
    await generateMainFile(liquibaseBasePath, liquibaseConfPath, basePath, classPath);
    sync(liquibaseBasePath, liquibaseConfPath, basePath, classPath, dryrun);
    console.log('<<<');
    handled = true;
  }

  if (args.diff) {
    console.log('Compare 2 databases'.action);
    console.log('>>>');
    diff(liquibaseBasePath, liquibaseConfPath, classPath);
    console.log('<<<');
    handled = true;
  }

  if (args.clear) {
    console.log('Clear Migration checksums'.action);
    console.log('>>>');
    clearCheckSums(liquibaseBasePath, liquibaseConfPath, basePath, classPath);
    console.log('<<<');
    handled = true;
  }

  if (args.rollback && args.name) {
    console.log('Rollback to specified tag'.action);
    console.log('>>>');
    rollback(liquibaseBasePath, liquibaseConfPath, basePath, classPath, args.name, args.tag, dryrun);
    console.log('<<<');
    handled = true;
  }

  if (args['create-version'] && args.version) {
    console.log(`${'[WARN'.warn} This command doesn't extract a valid MySQL and will be reworked in another ticket.`);
    console.log(`Create ${args.version} version`.action);
    console.log('>>>');
    createVersion(args.version, liquibaseBasePath, liquibaseConfPath, basePath, classPath);
    console.log('<<<');
    handled = true;
  }

  if (handled) {
    console.log('Command executed.'.debug);
    return Promise.resolve(true);
  }

  console.error(`${'[ERROR]'.error} Invalid or Missing Parameters`);
  process.exit(1337);
}

module.exports = {
  Handler,
};
