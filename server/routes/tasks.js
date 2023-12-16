import i18next from 'i18next';
import _ from 'lodash';

export default (app) => {
  app
    .get(
      '/tasks',
      { name: 'tasks', preValidation: app.authenticate },
      async (req, reply) => {
        const [statuses, users, labels] = await Promise.all([
          app.objection.models.taskStatus.query(),
          app.objection.models.user.query(),
          app.objection.models.label.query(),
        ]);

        // const tasks = await app.objection.models.task.query()
        //   // .select('id', 'name', 'statusId', 'creatorId', 'executorId')
        //   .withGraphFetched('[status, creator, executor]');

        const selection = Object.fromEntries(Object.entries(req.query)
          .filter(([, value]) => ((value !== '') && !(Number.isNaN(Number(value)))))
          .map(([key, value]) => ([key, Number(value)])));

        if (req.query?.isCreatorUser === 'on') selection.creator = req.session.get('userId');
        // eslint-disable-next-line object-curly-newline
        const { executor, label, status, creator } = selection;

        const tasks = await app.objection.models.task.query()
          .skipUndefined()
          .where('statusId', status)
          .where('executorId', executor)
          .where('creatorId', creator)
          .withGraphJoined('[labels]')
          .where('labelId', label);

        // await tasks.$query.withGraphJoined('[status, creator, executor]');

        await Promise.all(tasks.map((task) => task.$fetchGraph('[status, creator, executor]')));
        // req.log.info(`tasks: ${JSON.stringify(tasks)}`);

        Object.entries(tasks).forEach(([key, value]) => {
          req.log.trace(`tasks: ${key}:${value.name}:${value.creator.name}`);
        });
        req.log.trace(`tasks: req.query: ${JSON.stringify(req.query)}:-e ${executor}, l ${label}, s ${status}, c ${creator}`);

        reply.render('tasks/index', {
          tasks, statuses, users, labels, selection,
        });
        return reply;
      },
    )

    .get('/tasks/:id', { name: 'showTask', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const task = await app.objection.models.task.query().findById(id);
        req.log.trace(`showTask:task: ${JSON.stringify(task)}`);

        if (!task) throw new Error('Task not defined');

        await task.$fetchGraph('[status, creator, executor, labels]');

        req.log.trace(`showTask:formTask: ${JSON.stringify(task)}`);

        reply.render('tasks/show', { task });
        return reply;
      } catch (err) {
        req.log.error(`task:${JSON.stringify(err)}`);
        reply.redirect(app.reverse('tasks'));
        return reply;
      }
    })

    .get('/tasks/new', { name: 'newTask', preValidation: app.authenticate }, async (req, reply) => {
      const [task, statuses, users, labels] = await Promise.all([
        new app.objection.models.task(),
        app.objection.models.taskStatus.query(),
        app.objection.models.user.query(),
        app.objection.models.label.query(),
      ]);
      reply.render('tasks/new', {
        task, statuses, users, labels,
      });
      return reply;
    })

    .post('/tasks', { name: 'createTask', preValidation: app.authenticate }, async (req, reply) => {
      try {
        const { data } = req.body;
        req.log.trace(`createTask:req.body: ${JSON.stringify(data)}`);

        data.creatorId = req.session.get('userId');
        data.statusId = Number(data.statusId);
        data.executorId = (data.executorId === '') ? null : Number(data.executorId);
        const task = await app.objection.models.task.fromJson(_.omit(data, 'labels')); // _.omit(data, 'labels');

        const insertedGraphTask = await app.objection.models.task.transaction(async (trx) => {
          const newTask = await app.objection.models.task.query(trx).insert(task);

          // const labelIds = (data?.labels) ? [data.labels].flat().map(Number) : [];
          const labelIds = (data?.labels) ? (
            await Promise.all([data.labels].flat().map(async (item) => {
              if (Number(item)) {
                return Number(item);
              }

              const newLabel = JSON.parse(item);
              req.log.trace(`createTask: new label = ${item}`);
              if (newLabel?.name) {
                await app.objection.models.label.fromJson(newLabel);
                const label = await app.objection.models.label.query(trx)
                  .insert(newLabel);
                return label?.id;
              }
              throw new Error(`New task Label invalid format '${item}'`);
            }))
          ) : [];

          const reletedLabels = await app.objection.models.label.query(trx).findByIds(labelIds);

          req.log.trace(`createTask:reletedLabels: ${JSON.stringify(reletedLabels)}`);

          await Promise.all(labelIds.map((label) => newTask.$relatedQuery('labels', trx).relate(label)));
          req.log.trace(`createTask:reletedLabels: ${JSON.stringify(reletedLabels)}`);

          return newTask;
        });

        req.log.trace(`createTask:insertedTask: ${JSON.stringify(insertedGraphTask)}`);

        req.flash('info', i18next.t('flash.tasks.create.success'));
        reply.redirect(app.reverse('tasks'));
        return reply;
      } catch (error) {
        // const { data } = error;
        req.log.error(`createTask: ${JSON.stringify(error)}`);
        req.flash('error', i18next.t('flash.tasks.create.error'));

        const [statuses, users, labels] = await Promise.all([
          app.objection.models.taskStatus.query(),
          app.objection.models.user.query(),
          app.objection.models.label.query(),
        ]);
        reply.render('tasks/new', {
          task: req.body.data, statuses, users, labels, errors: error.data,
        });
        return reply;
      }
    })

    .get('/tasks/:id/edit', { name: 'editTask', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);
      try {
        const task = await app.objection.models.task.query().findById(id);

        await task.$fetchGraph('[labels]');
        task.labels = task.labels.map((label) => label.id);

        req.log.trace(`editTask:task: ${JSON.stringify(task)}`);

        if (!task) throw new Error('Task not defined');

        const [statuses, users, labels] = await Promise.all([
          app.objection.models.taskStatus.query(),
          app.objection.models.user.query(),
          app.objection.models.label.query(),
        ]);

        reply.render('tasks/edit', {
          task, statuses, users, labels,
        });
        return reply;
      } catch (err) {
        req.log.error(`editTask:${JSON.stringify(err)}`);
        reply.redirect(app.reverse('tasks'));
        return reply;
      }
    })

    .patch('/tasks/:id', { name: 'updateTask', preValidation: app.authenticate }, async (req, reply) => {
      const id = Number(req.params?.id);

      try {
        const { data } = req.body;
        req.log.debug(`updateTask:req.body: ${JSON.stringify(data)}`);

        data.creatorId = req.session.get('userId');
        data.statusId = Number(data.statusId);
        data.executorId = (data.executorId === '') ? null : Number(data.executorId);

        req.log.info(`updateTask:data: ${JSON.stringify(data)}`);
        const task = await app.objection.models.task.fromJson(data);

        const updatedGraphTask = await app.objection.models.task.transaction(async (trx) => {
          const taskUpdated = await app.objection.models.task.query(trx)
            .findById(id);

          const unrelatedLabels = await taskUpdated.$relatedQuery('labels', trx)
            .unrelate();
          req.log.trace(`updateTask: unrelatedLabels: ${unrelatedLabels}`);

          // const labelIds = [data.labels].flat().map(Number);
          const labelIds = (data?.labels) ? (
            await Promise.all([data.labels].flat().map(async (item) => {
              if (Number(item)) {
                return Number(item);
              }

              const newLabel = JSON.parse(item);
              req.log.trace(`updateTask: new label = ${item}`);
              if (newLabel?.name) {
                await app.objection.models.label.fromJson(newLabel);
                const label = await app.objection.models.label.query(trx)
                  .insert(newLabel);
                return label?.id;
              }
              throw new Error(`New task Label invalid format '${item}'`);
            }))
          ) : [];
          req.log.trace(`updateTask: labelIds: ${labelIds}`);
          const reletedLabels = await app.objection.models.label.query(trx).findByIds(labelIds);
          req.log.trace(`updateTask: reletedLabels:${reletedLabels}`);
          await taskUpdated.$query(trx).update(task);
          await Promise.all(labelIds.map((label) => taskUpdated.$relatedQuery('labels', trx).relate(label)));
          req.log.trace(`updateTask: taskUpdated:${taskUpdated}`);

          return taskUpdated;
        });

        req.log.trace(`updateTask:inserted: ${JSON.stringify(updatedGraphTask)}`);

        req.flash('info', i18next.t('flash.tasks.edit.success'));
        reply.redirect(app.reverse('tasks'));
        return reply;
      } catch (err) {
        req.log.error(`updateTask: ${JSON.stringify(err)}`);

        const [statuses, users, labels] = await Promise.all([
          app.objection.models.taskStatus.query(),
          app.objection.models.user.query(),
          app.objection.models.label.query(),
        ]);
        req.flash('error', i18next.t('flash.tasks.edit.error'));
        reply.render('tasks/edit', {
          task: { ...req.body.data, id }, statuses, users, labels, error: err.data,
        });
        return reply;
      }
    })

    .delete('/tasks/:id', { name: 'deleteTask', preValidation: app.authenticate }, async (req, reply) => {
      try {
        const id = Number(req.params?.id);
        const task = await app.objection.models.task.query().findById(id);
        if (task.creatorId === req.session.get('userId')) {
          const returnValue = await app.objection.models.task
            .transaction(async (trx) => {
              req.log.trace(`deleteTask: task = ${task}`);
              const unrelatedLabels = await task.$relatedQuery('labels', trx)
                .unrelate();
              req.log.trace(`updateTask: unrelatedLabels: ${unrelatedLabels}`);
              const idDeleted = await task.$query(trx).delete();
              req.log.info(`deleteTask: id = ${idDeleted}`);
              req.flash('info', i18next.t('flash.tasks.delete.success'));
              return task;
            });
          req.log.trace(`deleteTask: delete task succesfull: = ${returnValue}`);
        } else {
          req.log.error(`deleteTask: task created by userId ${task.creatorId} `);
          req.flash('error', i18next.t('flash.tasks.delete.accessError'));
        }
      } catch (err) {
        req.log.error(`deleteTask: ${JSON.stringify(err)}`);
        req.flash('error', i18next.t('flash.tasks.delete.error'));
      }

      reply.redirect(app.reverse('tasks'));
      return reply;
    });
};
