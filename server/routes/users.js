// @ts-check

import i18next from 'i18next';
import _ from 'lodash';

export default (app) => {
  app
    .get('/users', { name: 'users' }, async (req, reply) => {
      const users = await app.objection.models.user.query();

      Object.entries(users).forEach(([key1, value]) => {
        req.log.info(`user: ${key1}: ${value.email}: ${value.fullName()}, ${value.firstName}`);
      });
      reply.render('users/index', { users });
      return reply;
    })
    .get('/users/new', { name: 'newUser' }, (req, reply) => {
      const user = new app.objection.models.user();
      reply.render('users/new', { user });
    })
    .post('/users', async (req, reply) => {
      try {
        const user = await app.objection.models.user.fromJson(req.body.data);
        req.log.info(`/users post: ${user.email}, ${user.firstName}`);

        await app.objection.models.user.query().insert(user);
        req.log.info('/users post: success');

        req.flash('info', i18next.t('flash.users.create.success'));
        reply.redirect(app.reverse('root'));
        return reply;
      } catch ({ data }) {
        req.flash('error', i18next.t('flash.users.create.error'));
        reply.render('users/new', { user: req.body.data, errors: data });
        return reply;
      }
    })
    .get('/users/:id/edit', { name: 'openForEditUser' }, async (req, reply) => {
      const id = Number(req.params?.id);
      const cookieId = req.session.get('userId');
      if (!cookieId || (id !== cookieId)) {
        req.log.error(` /users/:id/edit error session = ${cookieId}`);
        //  <div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>
        req.flash('error', i18next.t('flash.authError'));
        reply.redirect('/');
        return reply;
      }
      req.log.info(`/users edit cookieId = ${cookieId}`);
      try {
        req.log.info(`/users edit id = ${id}`);
        const user = await app.objection.models.user.query().findById(id);
        req.log.info(`/users edit user = ${JSON.stringify(user)}`);
        if (!user) throw new Error('User not defined');

        req.log.info(`/users edit id = ${id} render`);
        reply.render('users/edit', { user });
        return reply;
      } catch ({ data }) {
        req.log.error(` /users/:id/edit error = ${data}`);

        req.flash('error', i18next.t('flash.users.edit.error'));
        reply.redirect('/users');
        return reply;
      }
    })
    .patch('/users/:id', { name: 'updateUser' }, async (req, reply) => {
      const id = Number(req.params?.id);
      const cookieId = req.session.get('userId');
      req.log.info(`/users patch:  id = ${id}`);
      if (!cookieId || (id !== cookieId)) {
        req.log.error(` patch error session = ${cookieId}`);
        //  <div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>
        req.flash('error', i18next.t('flash.authError'));
        reply.redirect('/');
        return reply;
      }

      try {
        const user = await app.objection.models.user.fromJson(req.body.data);

        req.log.info(`/users patch data email: ${user.email}`);
        req.log.info(`/users patch data : ${JSON.stringify(user)}`);

        const userUpdated = await app.objection.models.user.query()
          .findById(id);

        await userUpdated.$query().update(req.body.data);
        req.log.info(`/users update OK : ${JSON.stringify(userUpdated)}`);
        req.log.info('/users patch: success');

        req.flash('info', i18next.t('flash.users.edit.success'));
        reply.redirect(app.reverse('users'));
        return reply;
      } catch ({ data }) {
        req.log.info(`/users patch: fail. data = ${data}`);

        req.flash('error', i18next.t('flash.users.edit.error'));
        reply.render('users/edit', { user: { ...req.body.data, curId: id }, errors: data });
        return reply;
      }
    })
    .delete('/users/:id', { name: 'deleteUser' }, async (req, reply) => {
      const id = Number(req.params?.id);
      const cookieId = req.session.get('userId');
      req.log.info(`deleteUser:  id = ${id}`);
      // authentication (registration) check
      if (!cookieId) {
        req.log.error(`deleteUser: error session = ${cookieId}`);
        // <div class="alert alert-danger">Доступ запрещён! Пожалуйста, авторизируйтесь.</div>
        req.flash('error', i18next.t('flash.authError'));
        reply.redirect(app.reverse('root'));
        return reply;
      }
      // access check
      if ((id !== cookieId)) {
        req.log.error(`deleteUser: error cookieId = ${cookieId}`);
        // eslint-disable-next-line max-len
        // <div class="alert alert-danger">Вы не можете редактировать или удалять другого пользователя</div>
        req.flash('error', i18next.t('flash.users.accessError'));
        reply.redirect(app.reverse('users'));
        return reply;
      }

      try {
        const user = await app.objection.models.user.query().findById(id);

        req.log.info(`deleteUser: id = ${JSON.stringify(user.name)}`);

        const createdTasks = await user.$relatedQuery('createdTasks');
        const assignedTasks = await user.$relatedQuery('assignedTasks');

        if (_.isEmpty([...createdTasks, ...assignedTasks])) {
          req.logOut();
          await user.$query().delete();
          req.log.info(`deleteUser: logOut ${user.name}`);
          req.flash('success', i18next.t('flash.users.delete.success'));
        } else {
          req.log.info('deleteUser: fail: user associated with task');
          req.flash('error', i18next.t('flash.users.delete.error'));
        }
        reply.redirect(app.reverse('users'));
        return reply;
      } catch (err) {
        req.flash('error', i18next.t('flash.users.delete.error'));
        req.log.error(`deleteUser: error: fail id = ${id}, data = ${err}`);
        reply.redirect(app.reverse('users'));
        return reply;
      }
    });
};
