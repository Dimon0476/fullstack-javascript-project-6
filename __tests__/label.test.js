import i18next from 'i18next';
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

describe('test labels CRUD', () => {
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
      url: app.reverse('labels'),
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
    // 'Вы залогинены'
    expect(response.body).toContain(i18next.t('flash.session.create.success'));
    expect(response.body).toContain(getFlashMessage(flash.success, 'flash.session.create.success'));
  });

  it('index not authorized', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('labels'),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(app.reverse('root'));

    // провека наличия флэш-сообщения
    const responseRedirect = await app.inject({
      method: 'GET',
      url: response.headers.location,
      cookies: getCookie(response),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(app.reverse('root'));

    // Доступ запрещён!
    expect(responseRedirect.body).toContain(i18next.t('flash.authError'));
    expect(responseRedirect.body).toContain(getFlashMessage(flash.danger, 'flash.authError'));
  });

  it('new', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('newLabel'),
      cookies: cookie,
    });

    expect(response.statusCode).toBe(200);
  });

  describe('create', () => {
    it('should by successful', async () => {
      const params = { name: 'new label' }; // todo
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('createLabel'),
        payload: { data: params },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('labels'));

      const expected = params;
      const label = await models.label.query()
        .findOne({ name: params.name });

      expect(label).toMatchObject(expected);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('labels'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);
      // 'Метка успешно создана'
      expect(responseRedirect.body).toContain(i18next.t('flash.labels.create.success'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.info, 'flash.labels.create.success'));
    });
  });

  describe('update', () => {
    it('should by successful', async () => {
      const paramsExistingLabel = testData.labels.existing;

      const id = await getIdInstanceFromModel(models.label, paramsExistingLabel);

      const responseEditLabel = await app.inject({
        method: 'GET',
        url: app.reverse('openForEditLabel', { id }),
        cookies: cookie,
      });

      expect(responseEditLabel.statusCode).toBe(200);

      // cookie = getCookie(responseEditLabel);

      const paramsUpdated = testData.labels.updated;
      const response = await app.inject({
        method: 'PATCH',
        url: app.reverse('updateLabel', { id }),
        payload: {
          data: paramsUpdated,
        },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('labels'));

      const expected = paramsUpdated;

      const label = await models.label.query()
        .findOne({ name: paramsUpdated.name });
      expect(label).toMatchObject(expected);

      const nonExistingLabel = await models.label.query()
        .findOne({ name: paramsExistingLabel.name });
      expect(nonExistingLabel).toBeUndefined();

      cookie = getCookie(response);
      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('labels'),
        cookies: cookie,
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Метка успешно изменёна'
      expect(responseRedirect.body).toContain(i18next.t('flash.labels.edit.success'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.info, 'flash.labels.edit.success'));
    });
  });

  describe('delete', () => {
    it('should by successful', async () => {
      const paramsExistingLabel = testData.labels.unrelated;
      const id = await getIdInstanceFromModel(models.label, paramsExistingLabel);

      const response = await app.inject({
        method: 'DELETE',
        url: app.reverse('deleteLabel', { id }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('labels'));

      const nonExistentLabel = await models.label.query()
        .findOne(paramsExistingLabel);
      expect(nonExistentLabel).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('labels'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Метка успешно удалена'
      expect(responseRedirect.body).toContain(i18next.t('flash.labels.delete.success'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.info, 'flash.labels.delete.success'));
    });
    it('should by fail (in use)', async () => {
      const paramsExistingLabel = testData.labels.existing;
      const id = await getIdInstanceFromModel(models.label, paramsExistingLabel);

      const response = await app.inject({
        method: 'DELETE',
        url: app.reverse('deleteLabel', { id }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('labels'));

      const existentLabel = await models.label.query()
        .findOne(paramsExistingLabel);
      expect(existentLabel).toMatchObject(paramsExistingLabel);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('labels'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);

      // 'Не удалось удалить метку'
      expect(responseRedirect.body).toContain(i18next.t('flash.labels.delete.error'));
      expect(responseRedirect.body).toContain(getFlashMessage(flash.danger, 'flash.labels.delete.error'));
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
