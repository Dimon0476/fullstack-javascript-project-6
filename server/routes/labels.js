import i18next from 'i18next';
import _ from 'lodash';

export default (app) => {
  app
    .get('/labels', { name: 'labels', preValidation: app.authenticate }, async (req, reply) => {
      const labels = await app.objection.models.label.query();

      Object.entries(labels).forEach(([key, value]) => {
        req.log.info(`labels: ${key}:${value.name}`);
      });
      reply.render('labels/index', { labels });
      return reply;
    })
    .get('/labels/new', { name: 'newLabel', preValidation: app.authenticate }, (req, reply) => {
      const label = new app.objection.models.label();
      reply.render('labels/new', { label });
    })
    .post('/labels', { name: 'createLabel', preValidation: app.authenticate }, async (req, reply) => {
      try {
        const label = await app.objection.models.label
          .fromJson(req.body.data);
        await app.objection.models.label.query().insert(label);

        req.flash('info', i18next.t('flash.labels.create.success'));
        reply.redirect(app.reverse('labels'));
        return reply;
      } catch ({ data }) {
        req.flash('error', i18next.t('flash.labels.create.error'));
        reply.render('labels/new', { label: req.body.data, errors: data });
        return reply;
      }
    })
    .get('/labels/:id/edit', { name: 'openForEditLabel', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const label = await app.objection.models.label.query()
          .findById(id);

        if (!label) throw new Error('Task Label not defined');

        reply.render('labels/edit', { label });
        return reply;
      } catch ({ data }) {
        reply.redirect(app.reverse('labels'));
        return reply;
      }
    })
    .patch('/labels/:id', { name: 'updateLabel', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      if (!id) {
        reply.redirect('/');
        req.flash('error', i18next.t('flash.labels.edit.error'));
        return reply;
      }

      try {
        const label = await app.objection.models.label.fromJson(req.body.data);
        req.log.info(`/label patch data : ${JSON.stringify(label)}`);
        const labelUpdated = await app.objection.models.label.query()
          .findById(id);

        await labelUpdated.$query().update(req.body.data);
        req.flash('info', i18next.t('flash.labels.edit.success'));
        reply.redirect(app.reverse('labels'));

        return reply;
      } catch ({ data }) {
        req.log.info(`/label patch: fail. data = ${data}`);
        req.flash('error', i18next.t('flash.labels.edit.error'));
        reply.render('labels/edit', { label: { ...req.body.data, id }, errors: data });
        return reply;
      }
    })
    .delete('/labels/:id', { name: 'deleteLabel', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const label = await app.objection.models.label.query().findById(id);

        const reletedTasks = await label.$relatedQuery('tasks');

        if (_.isEmpty(reletedTasks)) {
          await label.$query().delete();
          req.log.info(`deleteLabel: labels: ${JSON.stringify(label)}`);
          req.flash('info', i18next.t('flash.labels.delete.success'));
        } else {
          req.log.info('deleteLabel: fail: label in use');
          req.flash('error', i18next.t('flash.labels.delete.error'));
        }
      } catch (err) {
        req.log.error(`deleteLabel: fail:  ${JSON.stringify(err)}`);
        req.flash('error', i18next.t('flash.labels.delete.error'));
      }
      reply.redirect(app.reverse('labels'));
      return reply;
    });
};
