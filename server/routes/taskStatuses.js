import i18next from 'i18next';
import _ from 'lodash';

export default (app) => {
  app
    .get('/statuses', { name: 'statuses', preValidation: app.authenticate }, async (req, reply) => {
      const statuses = await app.objection.models.taskStatus.query();

      Object.entries(statuses).forEach(([key, value]) => {
        req.log.info(`statuses: ${key}:${value.name}`);
      });
      reply.render('statuses/index', { statuses });
      return reply;
    })
    .get('/statuses/new', { name: 'newStatus', preValidation: app.authenticate }, (req, reply) => {
      const status = new app.objection.models.taskStatus();
      reply.render('statuses/new', { status });
    })
    .post('/statuses', { name: 'createStatus', preValidation: app.authenticate }, async (req, reply) => {
      try {
        const status = await app.objection.models.taskStatus
          .fromJson(req.body.data);
        await app.objection.models.taskStatus.query().insert(status);

        req.flash('info', i18next.t('flash.statuses.create.success'));
        reply.redirect(app.reverse('statuses'));
        return reply;
      } catch ({ data }) {
        req.flash('error', i18next.t('flash.statuses.create.error'));
        reply.render('statuses/new', { status: req.body.data, errors: data });
        return reply;
      }
    })
    .get('/statuses/:id/edit', { name: 'openForEditStatus', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const status = await app.objection.models.taskStatus.query()
          .findById(id);

        if (!status) throw new Error('Task Status not defined');

        reply.render('statuses/edit', { status });
        return reply;
      } catch ({ data }) {
        reply.redirect(app.reverse('statuses'));
        return reply;
      }
    })
    .patch('/statuses/:id', { name: 'updateStatus', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      if (!id) {
        reply.redirect('/');
        req.flash('error', i18next.t('flash.statuses.edit.error'));
        return reply;
      }

      try {
        const status = await app.objection.models.taskStatus.fromJson(req.body.data);
        req.log.info(`/status patch data : ${JSON.stringify(status)}`);
        const statusUpdated = await app.objection.models.taskStatus.query()
          .findById(id);

        await statusUpdated.$query().update(req.body.data);
        req.flash('info', i18next.t('flash.statuses.edit.success'));
        reply.redirect(app.reverse('statuses'));

        return reply;
      } catch ({ data }) {
        req.log.info(`/status patch: fail. data = ${data}`);
        req.flash('error', i18next.t('flash.statuses.edit.error'));
        reply.render('statuses/edit', { status: { ...req.body.data, id }, errors: data });
        return reply;
      }
    })
    .delete('/statuses/:id', { name: 'deleteStatus', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const status = await app.objection.models.taskStatus.query().findById(id);

        const reletedTasks = await status.$relatedQuery('tasks');

        if (_.isEmpty(reletedTasks)) {
          await status.$query().delete();
          req.log.info(`deleteStatus: statuses: ${JSON.stringify(status)}`);
          req.flash('info', i18next.t('flash.statuses.delete.success'));
        } else {
          req.log.info('deleteStatus: fail: status in use');
          req.flash('error', i18next.t('flash.statuses.delete.error'));
        }
      } catch (err) {
        req.log.error(`deleteStatus: fail:  ${JSON.stringify(err)}`);
        req.flash('error', i18next.t('flash.statuses.delete.error'));
      }
      reply.redirect(app.reverse('statuses'));
      return reply;
    });
};
