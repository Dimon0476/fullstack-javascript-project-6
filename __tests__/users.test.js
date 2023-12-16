// @ts-check

import _ from 'lodash';
import i18next from 'i18next';
import getApp from '../server/index.js';
import encrypt from '../server/lib/secure.cjs';
import {
  getTestData,
  prepareData,
  removeData,
  getNewFakerUser,
} from './helpers/index.js';

describe('test users CRUD', () => {
  let app;
  let knex;
  let models;
  const testData = getTestData();

  const signIn = async (params) => {
    const response = await app.inject({
      method: 'POST',
      url: app.reverse('session'),
      payload: { data: params },
    });

    expect(response.statusCode).toBe(302);

    return response;
  };

  const getCookie = (response) => {
    const [sessionCookie] = response.cookies;
    const { name, value } = sessionCookie;
    const cookie = { [name]: value };

    return cookie;
  };

  const getIdExistingUser = async (params) => {
    const existingUser = await models.user.query().findOne({ email: params.email });
    expect(existingUser).toBeDefined();
    return existingUser?.id;
  };

  beforeAll(async () => {
    app = await getApp();
    knex = app.objection.knex;
    models = app.objection.models;
    await knex.migrate.latest();
  });

  beforeEach(async () => {
    // тесты не должны зависеть друг от друга
    // перед каждым тестом выполняем миграции
    // и заполняем БД тестовыми данными
    await prepareData(app);
  });

  it('index', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('users'),
    });

    expect(response.statusCode).toBe(200);
  });

  it('new', async () => {
    const response = await app.inject({
      method: 'GET',
      url: app.reverse('newUser'),
    });

    expect(response.statusCode).toBe(200);
  });

  describe('create', () => {
    it('C success', async () => {
      const params = getNewFakerUser();
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('users'),
        payload: {
          data: params,
        },
      });

      expect(response.statusCode).toBe(302);
      const expected = {
        ..._.omit(params, 'password'),
        passwordDigest: encrypt(params.password),
      };
      const user = await models.user.query().findOne({ email: params.email });
      expect(user).toMatchObject(expected);

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('root'));

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('root'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);
      // 'Пользователь успешно зарегистрирован'
      expect(responseRedirect.body).toContain(i18next.t('flash.users.create.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Пользователь успешно зарегистрирован</div>');
    });

    it('C empty fail', async () => {
      const params = {
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      };
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('users'),
        payload: {
          data: params,
        },
      });

      expect(response.statusCode).toBe(200);
      // 'Не удалось зарегистрировать'
      expect(response.body).toContain(i18next.t('flash.users.create.error'));
      expect(response.body).toContain('<div class="alert alert-danger">Не удалось зарегистрировать</div>');
    });
  });

  describe('update', () => {
    it('U success', async () => {
      const paramsExistingUserToUpdate = testData.users.existing;
      const responseSignIn = await signIn(paramsExistingUserToUpdate);

      expect(responseSignIn.statusCode).toBe(302);
      expect(responseSignIn.headers.location).toBe(app.reverse('root'));

      const cookie = getCookie(responseSignIn);
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const responseEditUser = await app.inject({
        method: 'GET',
        url: `/users/${id}/edit`,
        cookies: cookie,
      });

      expect(responseEditUser.statusCode).toBe(200);
      // 'Вы залогинены'
      expect(responseEditUser.body).toContain('<div class="alert alert-success">Вы залогинены</div>');
      expect(responseEditUser.body).toContain(i18next.t('flash.session.create.success'));

      const paramsUpdated = testData.users.updated;
      const response = await app.inject({
        method: 'PATCH',
        // url: app.reverse('updateUser'),
        url: `/users/${id}`,
        payload: {
          data: paramsUpdated,
        },
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('users'));

      const expected = {
        ..._.omit(paramsUpdated, 'password'),
        passwordDigest: encrypt(paramsUpdated.password),
      };
      const user = await models.user.query()
        .findOne({ email: paramsUpdated.email });
      expect(user).toMatchObject(expected);

      const nonExistentUser = await models.user.query()
        .findOne({ email: paramsExistingUserToUpdate.email });
      expect(nonExistentUser).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: app.reverse('users'),
        cookies: getCookie(response),
      });
      expect(responseRedirect.statusCode).toBe(200);
      // 'Пользователь успешно изменён'
      expect(responseRedirect.body).toContain('<div class="alert alert-info">Пользователь успешно изменён</div>');
      expect(responseRedirect.body).toContain(i18next.t('flash.users.edit.success'));
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it('U get fail', async () => {
      const responseOpen = await app.inject({
        method: 'GET',
        url: app.reverse('users'),
      });

      expect(responseOpen.statusCode).toBe(200);
      // TO DO : проверить наличие пользователя на странице

      const paramsExistingUserToUpdate = testData.users.existing;
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const responseEditUser = await app.inject({
        method: 'GET',
        url: `/users/${id}/edit`,
        cookies: getCookie(responseOpen),
      });

      expect(responseEditUser.statusCode).toBe(302);
      expect(responseEditUser.headers.location).toBe(app.reverse('root'));

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: responseEditUser.headers.location,
        cookies: getCookie(responseEditUser),
      });

      expect(responseRedirect.body)
        .toContain('<div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>');
      expect(responseRedirect.body).toContain(i18next.t('flash.authError'));
    });

    it('U patch fail', async () => {
      const paramsExistingUserToUpdate = testData.users.existing;
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const paramsUpdated = testData.users.updated;
      const responsePatch = await app.inject({
        method: 'PATCH',
        url: `/users/${id}`,
        payload: {
          data: paramsUpdated,
        },
      });

      expect(responsePatch.statusCode).toBe(302);
      expect(responsePatch.headers.location).toBe(app.reverse('root'));

      const expected = {
        ..._.omit(paramsExistingUserToUpdate, 'password'),
        passwordDigest: encrypt(paramsExistingUserToUpdate.password),
      };
      const user = await models.user.query()
        .findOne({ email: paramsExistingUserToUpdate.email });
      expect(user).toMatchObject(expected);

      const nonExistentUser = await models.user.query()
        .findOne({ email: paramsUpdated.email });
      expect(nonExistentUser).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: responsePatch.headers.location,
        cookies: getCookie(responsePatch),
      });

      expect(responseRedirect.body)
        .toContain('<div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>');
      expect(responseRedirect.body).toContain(i18next.t('flash.authError'));
    });
  });

  describe('delete', () => {
    it('D success', async () => {
      const paramsExistingUserToUpdate = testData.users.existing;
      const responseSignIn = await signIn(paramsExistingUserToUpdate);

      expect(responseSignIn.statusCode).toBe(302);
      expect(responseSignIn.headers.location).toBe(app.reverse('root'));

      const cookie = getCookie(responseSignIn);
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const user = await app.objection.models.user.query().findById(id);

      const createdTasks = await user.$relatedQuery('createdTasks');
      const assignedTasks = await user.$relatedQuery('assignedTasks');

      const tasks = _.union(createdTasks, assignedTasks);

      await Promise.all(tasks.map((task) => task.$query().delete()));

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${id}`,
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('users'));

      const nonExistentUser = await models.user.query()
        .findOne({ email: paramsExistingUserToUpdate.email });
      expect(nonExistentUser).toBeUndefined();

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: response.headers.location,
        cookies: getCookie(response),
      });

      // '>Пользователь успешно удалён'
      expect(responseRedirect.body).toContain(i18next.t('flash.users.delete.success'));
      expect(responseRedirect.body).toContain('<div class="alert alert-success">Пользователь успешно удалён</div>');
    });

    it('D associated with task fail', async () => {
      const paramsExistingUserToUpdate = testData.users.existing;
      const responseSignIn = await signIn(paramsExistingUserToUpdate);

      expect(responseSignIn.statusCode).toBe(302);
      expect(responseSignIn.headers.location).toBe(app.reverse('root'));

      const cookie = getCookie(responseSignIn);
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${id}`,
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('users'));

      const expected = {
        ..._.omit(paramsExistingUserToUpdate, 'password'),
        passwordDigest: encrypt(paramsExistingUserToUpdate.password),
      };

      const user = await models.user.query()
        .findOne({ email: paramsExistingUserToUpdate.email });
      expect(user).toMatchObject(expected);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: response.headers.location,
        cookies: getCookie(response),
      });

      // 'Не удалось удалить пользователя'
      expect(responseRedirect.body).toContain(i18next.t('flash.users.delete.error'));
      expect(responseRedirect.body).toContain('<div class="alert alert-danger">Не удалось удалить пользователя</div>');
    });
    it('D unlogged user fail', async () => {
      const paramsExistingUserToUpdate = testData.users.existing;
      const id = await getIdExistingUser(paramsExistingUserToUpdate);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${id}`,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('root'));

      const expected = {
        ..._.omit(paramsExistingUserToUpdate, 'password'),
        passwordDigest: encrypt(paramsExistingUserToUpdate.password),
      };
      const user = await models.user.query()
        .findOne({ email: paramsExistingUserToUpdate.email });
      expect(user).toMatchObject(expected);

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

    it('D another user fail', async () => {
      // параметры создаваемго пользователя и существующего
      const paramsNewUser = testData.users.new;
      const paramsExistingUser = testData.users.existing;
      const idAnotherUser = await getIdExistingUser(paramsExistingUser);

      // Создание пользователя
      const responseCreateUser = await app.inject({
        method: 'POST',
        url: app.reverse('users'),
        payload: {
          data: paramsNewUser,
        },
      });
      expect(responseCreateUser.statusCode).toBe(302);

      // вход нового пользователя
      const responseSignInNewUser = await signIn(paramsNewUser);
      expect(responseSignInNewUser.statusCode).toBe(302);

      const cookieNewUser = getCookie(responseSignInNewUser);

      const responseNewRedirect = await app.inject({
        method: 'GET',
        url: responseSignInNewUser.headers.location,
        cookies: cookieNewUser,
      });

      expect(responseNewRedirect.statusCode).toBe(200);
      // 'Вы залогинены'
      expect(responseNewRedirect.body).toContain(i18next.t('flash.session.create.success'));
      expect(responseNewRedirect.body).toContain('<div class="alert alert-success">Вы залогинены</div>');

      // запрос на удаление другого существующего пользователя
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${idAnotherUser}`,
        cookies: cookieNewUser,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(app.reverse('users'));

      const expected = {
        ..._.omit(paramsExistingUser, 'password'),
        passwordDigest: encrypt(paramsExistingUser.password),
      };
      const user = await models.user.query()
        .findOne({ email: paramsExistingUser.email });
      expect(user).toMatchObject(expected);

      // провека наличия флэш-сообщения
      const responseRedirect = await app.inject({
        method: 'GET',
        url: response.headers.location,
        cookies: getCookie(response),
      });

      // Вы не можете редактировать или удалять другого пользователя
      expect(responseRedirect.body).toContain(i18next.t('flash.users.accessError'));
      expect(responseRedirect.body)
        .toContain('<div class="alert alert-danger">Вы не можете редактировать или удалять другого пользователя</div>');
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
