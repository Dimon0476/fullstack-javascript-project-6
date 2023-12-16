// @ts-check

import fs from 'fs';
import path from 'path';
import { faker } from '@faker-js/faker';
import i18next from 'i18next';

const getFixturePath = (filename) => path.join('..', '..', '__fixtures__', filename);
const readFixture = (filename) => fs.readFileSync(new URL(getFixturePath(filename), import.meta.url), 'utf-8').trim();
const getFixtureData = (filename) => JSON.parse(readFixture(filename));

export const getTestData = () => getFixtureData('testData.json');

export const prepareData = async (app) => {
  const { knex } = app.objection;

  // получаем данные из фикстур и заполняем БД
  await knex('users').insert(getFixtureData('users.json'));
  await knex('task_statuses').insert(getFixtureData('task_statuses.json'));
  await knex('tasks').insert(getFixtureData('tasks.json'));
  await knex('labels').insert(getFixtureData('labels.json'));
  await knex('tasks_labels').insert(getFixtureData('tasks_labels.json'));
};

export const removeData = async (app) => {
  const { knex } = app.objection;

  // удаление всех строк БД
  await knex('users').truncate();
  await knex('task_statuses').truncate();
  await knex('tasks').truncate();
  await knex('labels').truncate();
  await knex('tasks_labels').truncate();
  // после каждого теста откатываем миграции
  // Segmentation fault: 11
  // await knex.migrate.rollback();
};

export const getNewFakerUser = () => ({
  password: faker.internet.password(),
  email: faker.internet.email(),
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
});

export const getCookie = (response) => {
  const [sessionCookie] = response.cookies;
  expect(sessionCookie).toBeDefined();
  const { name, value } = sessionCookie;
  return { [name]: value };
};

export const signIn = async (app, params) => {
  const response = await app.inject({
    method: 'POST',
    url: app.reverse('session'),
    payload: { data: params },
  });

  return response;
};

// const id = await getIdInstanceFromModel(models.table, { params, ... });
export const getIdInstanceFromModel = async (modelTable, paramsInstance) => {
  const instance = await modelTable.query().findOne(paramsInstance);
  expect(instance).toBeDefined();
  return instance?.id;
};

export const typesFashMessage = {
  info: 'info',
  danger: 'danger',
  success: 'success',
};

export const getFlashMessage = (type = typesFashMessage.info, message = 'message') => `<div class="alert alert-${type}">${i18next.t(message)}</div>`;
