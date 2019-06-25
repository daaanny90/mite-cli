#!/usr/bin/env node
'use strict';

const config = require('./../../../config');
const miteApi = require('./../../mite-api')(config.get());

const defaults = [
  {
    name: '--archived',
    description: 'archive or unarchive a project',
  },
  {
    name: '--hourly-rate',
    description: 'change the hourly-rate',
  },
  {
    name: '--name',
    description: 'change the name of the project',
  },
  {
    name: '--note',
    description: 'change the note of the project',
  },
  {
    name: '--update-entries',
    description: 'update time entries when hourly_rate was changed',
  },
  {
    name: '--help',
    description: 'show help message',
  },
];

/**
 * https://www.npmjs.com/package/tabtab#3-parsing-env
 *
 * @param {string} env.lastPartial - the characters entered in the current
 *                               argument before hitting tabtab
 * @param {string} env.prev - last given argument value, or previously
 *                            completed value
 * @param {string} env.words - the number of argument currently active
 * @param {string} env.line - the current complete input line in the cli
 * @returns {Promise<Array<string>>}
 */
module.exports = async ({ prev, line }) => {
  // propose values for some of the arguments
  switch(prev) {
    case '--archived':
      return ['yes', 'no'];
    case '--name':
      return ['name'];
    case '--note':
      return ['note'];
    case '--hourly-rate':
      return ['0.00'];
  }

  // show list of archived or unarchived projects depending on the --archived
  // flag wich is allready been given
  let options = defaults.filter(option => {
    return line.indexOf(option.name) === -1;
  });

  // get a list of available customers from mite for adding them as options
  const requestOptions = {};
  if (line.match(/--archived/)) {
    customerOptions.archived = !/--archived[ =](yes|true|1|ja)/.test(line);
  }
  const customers = await miteApi.getCustomers(requestOptions);
  const customerOptions = customers.map(c => ({
    name: String(c.id),
    description: c.name
  }));

  // merge customer options and defaults togheter
  return [].concat(customerOptions, options);
};
