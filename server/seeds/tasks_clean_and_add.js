const fs = require('fs');
const path = require('path');

const getFixturePath = (filename) => path.join(__dirname, '..', '..', '__fixtures__', filename);
const readFixture = (filename) => fs.readFileSync(getFixturePath(filename), 'utf-8').trim();
const getFixtureData = (filename) => JSON.parse(readFixture(filename));

const fileNameToInsertData = 'tasks.json';

console.log('"tasks_clean_and_add"');
console.log(' - deleting everything');
console.log(' - insert data:', getFixturePath(fileNameToInsertData));

module.exports.seed = async (knex) => {
  await knex('tasks').del();
  await knex('tasks').insert(getFixtureData(fileNameToInsertData));
};
