#!/usr/bin/env node
'use strict';

const program = require('commander');
const util = require('util');

const pkg = require('./../package.json');
const miteApi = require('mite-api');
const config = require('./config');

program
  .version(pkg.version)
  .arguments('<customerId>')
  .description(
    'Updates a specific customer',
    // arguments description
    {
      customerId: 'Id of the customer of which the note should be altered'
    }
    )
  // @TODO add edit "hourly_rate"
  .option(
    '--archived <true|false>',
    'changes the archived state of the project',
    ((val) => {
      if (typeof val !== 'string') {
        return val;
      }
      return ['true', 'yes', 'ja', 'ok', '1'].indexOf(val.toLowerCase()) > -1;
    })
  )
  .option(
    '--name <name>',
    'changes the name of the customer to the given value',
    undefined
  )
  .option(
    '--note <note>',
    'changes the note of the customer to the given value',
  )
  .on('--help', () => {
    console.log(`
Examples:

  Put a customer into the archive:
    mite customer update --archived true 123456

  Unarchive a single customer
    mite customer update --archived false 123456

  Change the name of a customer
    mite customer update --name "" 123456

  Unarchive all archived customers
    mite customers --columns id --archived false --format=text | xargs -n1 mite customer update --archived false
`);
  })
  .action((customerId) => {
    const mite = miteApi(config.get());
    const data = {
      ...(typeof program.archived === 'boolean' && { archived: program.archived }),
      ...(typeof program.name === 'string' && { name: program.name }),
      ...(typeof program.note === 'string' && { note: program.note }),
    };
    return util.promisify(mite.updateCustomer)(customerId, data)
      .then(() => {
        console.log('Successfully updated customer (id: %s)', customerId);
      })
      .catch(err => {
        console.error('Error while updateing customer (id: %s)', customerId, err);
        process.exit(1);
      });
  })
  .parse(process.argv);

// show help message when the required first argument is not given
if (!program.args.length) {
  program.help();
  process.exit();
}
