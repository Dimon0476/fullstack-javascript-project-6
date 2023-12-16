import i18next from 'i18next';
import _ from 'lodash';
import getApp from '../server/index.js';
import {
  getTestData,
  prepareData,
  removeData,
  getCookie,
  signIn,
  getIdInstanceFromModel,
  getFlashMessage,
  typesFashMessage as flash,
} from './helpers/index.js';

describe('test tasks CRUD', () => {
  let app;
  let knex;
  let models;
  const testData = getTestData();
  let cookie;

  beforeAll(async () => {
    app = await getApp();
    knex = app.objection.knex;
    models = app.objection.models;
    await knex.migrate.latest();
  });

  beforeEach(async () => {
    // тесты не зависят друг от труга
    // выполняем миграции
    await prepareData(app);
    const responseSignIn = await signIn(app, testData.users.existing);
    cookie = getCookie(responseSignIn);
  });

  it('index authorized', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
    // 'Вы залогинены'
    expect(response.body).toContain('<div class="alert alert-success">Вы залогинены</div>');
    expect(response.body).toContain(i18next.t('flash.session.create.success'));
  });

  it('index not authorized', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('tasks'),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(app.reverse('root'));

    // провека наличия флэш-сообщения
    const responseRedirect = await app.inject({
      method: 'GET',
      url: response.headers.location,
      cookies: getCookie(response),
    });

    // Доступ запрещён!
    expect(responseRedirect.body).toContain(i18next.t('flash.authError'));
    expect(responseRedirect.body)
      .toContain('<div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>');
  });

  it('new', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('newTask'),
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
  });

  it('show', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('showTask', { id: 1 }),
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
  });

  describe('create', () => {
    // eslint-disable-next-line jest/no-disabled-tests
    it('should by successful', async () => {
      const params = testData.tasks.new.data;
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('tasks'),
        payload: { data: params },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('tasks'));

      const expected = {
        ..._.omit(params, 'labels'),
        statusId: Number(params.statusId),
        executorId: Number(params.executorId),
      };
      const task = await models.task.query()
        .findOne({ name: params.name });

      expect(task).toMatchObject(expected);

      await task.$fetchGraph('[labels]');

      const expectedLabels = params.labels;
      expectedLabels[0] = await models.label.query().findById(Number(params.labels[0]));
      expectedLabels[1] = await models.label.query().findById(Number(params.labels[1]));
      expectedLabels[2] = await models.label.query().findOne(JSON.parse(params.labels[2]));

      expect(task.labels).toEqual(expect.arrayContaining(expectedLabels));

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('statuses'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);
      // ' успешно создан'
      expect(responseRedirect.body).toContain(i18next.t('flash.tasks.create.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Задача успешно создана</div>');
    });
  });

  describe('update', () => {
    it('should by successful', async () => {
      const paramsExixttingTask = testData.tasks.existing.data;
      const id = await getIdInstanceFromModel(models.task, paramsExixttingTask);

      const responseEditTask = await app.inject({
        method: 'GET',
        url: app.reverse('createTask', { id }),
        cookies: cookie,
      });

      expect(responseEditTask.statusCode).toBe(200);

      const paramsUpdated = testData.tasks.updated.data;

      const response = await app.inject({
        method: 'PATCH',
        url: app.reverse('updateTask', { id }),
        payload: {
          data: paramsUpdated,
        },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('tasks'));

      const expected = {
        ..._.omit(paramsUpdated, 'labels'),
        statusId: Number(paramsUpdated.statusId),
        executorId: Number(paramsUpdated.executorId),
      };

      const task = await models.task.query()
        .findOne({ name: paramsUpdated.name });
      expect(task).toMatchObject(expected);

      await task.$fetchGraph('[labels]');

      const expectedLabels = paramsUpdated.labels;
      expectedLabels[0] = await models.label.query().findById(Number(paramsUpdated.labels[0]));
      expectedLabels[1] = await models.label.query().findById(Number(paramsUpdated.labels[1]));
      expectedLabels[2] = await models.label.query().findOne(JSON.parse(paramsUpdated.labels[2]));

      expect(task.labels).toEqual(expect.arrayContaining(expectedLabels));

      const nonExistingTask = await models.task.query()
        .findOne({ name: paramsExixttingTask.name });
      expect(nonExistingTask).toBeUndefined();

      cookie = getCookie(response);

      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('tasks'),
        cookies: cookie,
      });
      expect(responseRedirect.statusCode).toBe(200);

      expect(responseRedirect.body).toContain(i18next.t('flash.tasks.edit.success'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.info, 'flash.tasks.edit.success'));
    });
  });

  describe('delete', () => {
    it('should by successful', async () => {
      const paramsExistingTask = testData.tasks.existing.data;
      const id = await getIdInstanceFromModel(models.task, paramsExistingTask);

      const response = await app.inject({
        method: 'DELETE',
        url: app.reverse('deleteTask', { id }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('tasks'));

      const nonExistentTask = await models.task.query()
        .findOne(paramsExistingTask);
      expect(nonExistentTask).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('tasks'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // Задача успешно удалена
      expect(responseRedirect.body).toContain(i18next.t('flash.tasks.delete.success'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.info, 'flash.tasks.delete.success'));
    });

    it('should be with access error', async () => {
      const paramsAlternativeTask = testData.tasks.alternative.data;
      const id = await getIdInstanceFromModel(models.task, paramsAlternativeTask);

      const response = await app.inject({
        method: 'DELETE',
        url: app.reverse('deleteTask', { id }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('tasks'));

      const existentTask = await models.task.query()
        .findOne({ name: paramsAlternativeTask.name });
      expect(existentTask).toMatchObject(paramsAlternativeTask);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('tasks'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // Задачу может удалить только её автор
      expect(responseRedirect.body).toContain(i18next.t('flash.tasks.delete.accessError'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.danger, 'flash.tasks.delete.accessError'));
    });
  });
  // - /tasks?status=&executor=&label=&isCreatorUser=on
  describe('filtering', () => {
    it('by all options for 1 task', async () => {
      const response = await app.inject({
        method: 'GET',
        url: app.reverse('tasks'),
        cookies: cookie,
        query: testData.tasks.filter,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(testData.tasks.existing.data.name);
      expect(response.body).not.toContain(testData.tasks.alternative.data.name);
    });

    it('by empty options, out all tasks', async () => {
      const paramsFilter = testData.tasks.firlterEmpty;
      const response = await app.inject({
        method: 'GET',
        url: app.reverse('tasks'),
        cookies: cookie,
        query: paramsFilter,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(testData.tasks.existing.data.name);
      expect(response.body).toContain(testData.tasks.alternative.data.name);
    });
  });

  afterEach(async () => {
    await removeData(app);
  });

  afterAll(async () => {
    await app.close();
  });
});
