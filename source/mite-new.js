#!/usr/bin/env node
'use strict'

const program = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const miteApi = require('mite-api');
const util = require('util');

const pkg = require('./../package.json');
const config = require('./config.js');
const mite = miteApi(config.get());
const miteTracker = require('./lib/mite-tracker')(config.get());

program
  .version(pkg.version)
  .description(
    `Creates a new time entry` + "\n" +
    `When no note or just the note is given it will run in interactive mode ` +
    `where every other required parameter can be chosen from displayed ` +
    `options.` + "\n" +
    `If there are also project name, service name, minutes and optional data ` +
    `passed the time entry is created right away.`,
    {
      note: 'optional given pre-filled value for the time-entry content',
      project: 'optional name of the project for which the time entry should be created, note that this must be a case-insensitive match',
      service: 'optional name of the service which should be set for the new time entry, note that this must be a case-insensitive match',
      minutes: 'optional number of minutes which should be set for the time entry, add a "+" at the end to start the time entry',
      date: 'optional date for which the time entry should be created in the format YYYY-MM-DD'
    }
  )
  .arguments('[note] [project] [service] [minutes] [date]')
  .action((note, project, service, minutes, date) => {
    main(note, project, service, minutes, date);
  })
  .parse(process.argv);

// show help message when number of arguments is to much
if (process.argv.length > 7)  {
  program.help();
}

function getProjectChoices() {
  return util.promisify(mite.getProjects)()
    .then(response => response.map(d => d.project))
    .then(projects => projects.map(project => {
      const nameParts = [project.name];
      if (project.customer_name) {
        nameParts.push('(' + project.customer_name + ')')
      }
      return {
        name: nameParts.join(' '),
        value: project.id
      };
    }))
    .then(projects => {
      projects.push({
        name: '– (no project)',
        value: null,
      })
      return projects;
    });
}

function getServiceChoices() {
  return util.promisify(mite.getServices)()
    .then(response => response.map(d => d.service))
    .then(services => services.map(service => {
      const nameParts = [service.name];
      if (service.billable) {
        nameParts.push(chalk.yellow.bold('$'));
      }
      return { name: nameParts.join(' '), value: service.id};
    }))
    .then(services => {
      services.push({
        name: '– (no service)',
        value: null,
      });
      return services;
    });
}

function checkResults(options, query, type) {
  let searchResults = options.filter(result => {
    return result.name && (result.name.toUpperCase().indexOf(query.toUpperCase()) > -1);
  });
  switch (searchResults.length) {
    case 0:
      console.log(`No ${type}s found that match "${query}".`);
      break;
    case 1:
      return searchResults;
    default:
      console.log(`Found multiple ${type}s matching  "${query}":`);
      searchResults.forEach(current => console.log(`- ${current.name}`));
      break;
  }
  console.log(
    `Use the exact name of an existing ${type}s. List available ${type}s `+
    `using "mite ${type}s"`
  );
  process.exit(1);
}

function interactiveMode(note) {
    return Promise.all([
      getProjectChoices(),
      getServiceChoices(),
    ]).then(([projectChoices, serviceChoices]) => {
      return [
        {
          type: 'list',
          name: 'project_id',
          message: 'Choose Project',
          choices: projectChoices
        },
        {
          type: 'input',
          name: 'note',
          message: 'What was done?',
          when: !note,
        },
        {
          type: 'input',
          name: 'minutes',
          message: 'How long did it take in minutes?'
        },
        {
          type: 'list',
          name: 'service_id',
          message: 'What service?',
          choices: serviceChoices,
        },
        {
          type: 'input',
          name: 'date_at',
          message: 'Date?',
          default: (new Date()).toISOString().slice(0,10)
        }
      ]
    })
    .then((questions) => inquirer.prompt(questions));
}

function cliMode(note, project, service, minutes, date) {
  return Promise.all([
    getProjectChoices(project),
    getServiceChoices(service),
  ]).then(([projects, services]) => {
    projects = checkResults(projects, project, 'project');
    services = checkResults(services, service, 'service');
    let entry = {
      project_id: projects[0].value,
      note: note,
      minutes: minutes,
      service_id: services[0].value,
      date_at: date || (new Date()).toISOString().slice(0, 10)
    };
    return entry;
  });
}

function main(note, project, service, minutes, date) {
  let promise;
  if (!project) {
    promise = interactiveMode(note);
  } else {
    promise = cliMode(note, project, service, minutes, date);
  }

  return promise.then((entry) => {
    entry.note = entry.note || note;

    // do not create an entry when minutes are invalid
    if (!entry.minutes) {
      console.log('no time entry created due to empty project id or empty minutes')
      return;
    }

    // detect the "+" at the duration value and start a tracker for the time
    // entry
    let startTracker = false;
    if (entry.minutes.substr(-1, 1) === '+') {
      startTracker = true;
      entry.minutes = entry.minutes.substr(0, entry.minutes.length - 1);
    }

    // http://mite.yo.lk/en/api/time-entries.html#create
    mite.addTimeEntry({ time_entry: entry }, (response) => {
      var data = JSON.parse(response);
      if (data.error) {
        console.error('Error while creating new time entry:', data.error);
        process.exit(1);
        return;
      }
      const timeEntryId = data.time_entry.id;
      console.log('Successfully created new time entry (id: %s)', timeEntryId);
      if (startTracker) {
        miteTracker.start(timeEntryId)
          .then(() => {
            console.log('Successfully started the time entry (id: %s)', timeEntryId);
          })
          .catch((err) => {
            console.log('Unable to start the time entry (id: %s): %s', timeEntryId, err.message);
            process.exit(1);
          });
      }
    });
  });
}
