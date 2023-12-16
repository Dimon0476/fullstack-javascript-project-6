// @ts-check

const objectionUnique = require('objection-unique');
const BaseModel = require('./BaseModel.cjs');

const unique = objectionUnique({ fields: ['name'] });

module.exports = class Task extends unique(BaseModel) {
  static get tableName() {
    return 'tasks';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'statusId', 'creatorId'],

      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        statusId: {
          type: 'integer',
          minimum: 1,
        },
        creatorId: {
          type: 'integer',
          minimum: 1,
        },
        executorId: {
          type: ['integer', 'null'],
          minimum: 1,
        },
      },
    };
  }

  // This object defines the relations to other models.
  static get relationMappings() {
    // One way to prevent circular references
    // is to require the model classes here.
    return {
      status: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: 'TaskStatus.cjs',

        join: {
          from: 'tasks.statusId',
          to: 'task_statuses.id',
        },
      },

      labels: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: 'Label.cjs',

        join: {
          from: 'tasks.id',
          through: {
            from: 'tasks_labels.taskId',
            to: 'tasks_labels.labelId',
          },
          to: 'labels.id',
        },
      },

      creator: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: 'User.cjs',

        join: {
          from: 'tasks.creatorId',
          to: 'users.id',
        },
      },

      executor: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: 'User.cjs',

        join: {
          from: 'tasks.executorId',
          to: 'users.id',
        },
      },
    };
  }
};
