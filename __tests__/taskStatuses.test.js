import i18next from 'i18next';
import getApp from '../server/index.js';
import {
  getTestData,
  prepareData,
  removeData,
} from './helpers/index.js';

describe('test statuses CRUD', () => {
  let app;
  let knex;
  let models;
  const testData = getTestData();
  let cookie;

  const signIn = async (params) => {
    const response = await app.inject({
      method: 'POST',
      url: app.reverse('session'),
      payload: { data: params },
    });

    return response;
  };

  const getCookie = (response) => {
    const [sessionCookie] = response.cookies;
    expect(sessionCookie).toBeDefined();
    const { name, value } = sessionCookie;
    return { [name]: value };
  };

  const getIdExistingField = async (table, params) => {
    const existingInstance = await table.query().findOne(params);
    expect(existingInstance).toBeDefined();
    return existingInstance?.id;
  };

  const getIdInstance = async (table, params) => {
    const instance = await models[table].query().findOne(params);
    expect(instance).toBeDefined();
    return instance?.id;
  };

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

    const responseSignIn = await signIn(testData.users.existing);
    cookie = getCookie(responseSignIn);
  });

  it('index authorized', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/statuses',
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
      url: '/statuses',
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
      url: app.reverse('newStatus'),
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
  });

  describe('create', () => {
    it('should by successful', async () => {
      const params = { name: 'new status' }; // todo
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('statuses'),
        payload: { data: params },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('statuses'));

      const expected = params;
      const status = await models.taskStatus.query()
        .findOne({ name: params.name });

      expect(status).toMatchObject(expected);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('statuses'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);
      // 'Статус успешно создан'
      expect(responseRedirect.body).toContain(i18next.t('flash.statuses.create.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Статус успешно создан</div>');
    });
  });

  describe('update', () => {
    it('should by successful', async () => {
      const paramsExistingStatus = testData.taskStatuses.existing;

      const id = await getIdExistingField(models.taskStatus, { name: paramsExistingStatus.name });

      const responseEditStatus = await app.inject({
        method: 'GET',
        url: `/statuses/${id}/edit`,
        cookies: cookie,
      });

      expect(responseEditStatus.statusCode).toBe(200);

      // cookie = getCookie(responseEditStatus);

      const paramsUpdated = testData.taskStatuses.updated;
      const response = await app.inject({
        method: 'PATCH',
        url: `/statuses/${id}`,
        payload: {
          data: paramsUpdated,
        },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('statuses'));

      const expected = paramsUpdated;

      const status = await models.taskStatus.query()
        .findOne({ name: paramsUpdated.name });
      expect(status).toMatchObject(expected);

      const nonExistingStatus = await models.taskStatus.query()
        .findOne({ name: paramsExistingStatus.name });
      expect(nonExistingStatus).toBeUndefined();

      cookie = getCookie(response);
      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('statuses'),
        cookies: cookie,
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Статус успешно изменён'
      expect(responseRedirect.body).toContain(i18next.t('flash.statuses.edit.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Статус успешно изменён</div>');
    });
  });

  describe('delete', () => {
    it('should by successful', async () => {
      const paramsExistingStatus = testData.taskStatuses.unrelated;
      const id = await getIdInstance('taskStatus', paramsExistingStatus);

      const response = await app.inject({
        method: 'DELETE',
        url: `/statuses/${id}`,
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('statuses'));

      const nonExistentStatus = await models.taskStatus.query()
        .findOne(paramsExistingStatus);
      expect(nonExistentStatus).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('statuses'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Статус успешно удалён'
      expect(responseRedirect.body).toContain(i18next.t('flash.statuses.delete.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Статус успешно удалён</div>');
    });
    it('should by fail (in use)', async () => {
      const paramsExistingStatus = testData.taskStatuses.existing;
      const id = await getIdInstance('taskStatus', paramsExistingStatus);

      const response = await app.inject({
        method: 'DELETE',
        url: `/statuses/${id}`,
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('statuses'));

      const existentStatus = await models.taskStatus.query()
        .findOne(paramsExistingStatus);
      expect(existentStatus).toMatchObject(paramsExistingStatus);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('statuses'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Не удалось удалить статус'
      expect(responseRedirect.body).toContain(i18next.t('flash.statuses.delete.error'));
      expect(responseRedirect.body).toContain('<div class="alert alert-danger">Не удалось удалить статус</div>');
    });
  });

  afterEach(async () => {
    // после каждого теста откатываем миграции
    await removeData(app);
  });

  afterAll(async () => {
    await app.close();
  });
});
