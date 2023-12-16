// @ts-check

const objectionUnique = require('objection-unique');
const BaseModel = require('./BaseModel.cjs');
const encrypt = require('../lib/secure.cjs');

const unique = objectionUnique({ fields: ['email'] });

module.exports = class User extends unique(BaseModel) {
  // @ts-ignore
  static get tableName() {
    return 'users';
  }

  fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  // @ts-ignore
  static get jsonSchema() {
    return {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', minLength: 1 },
        password: { type: 'string', minLength: 3 },
        firstName: { type: 'string', minLength: 1 },
        lastName: { type: 'string', minLength: 1 },
      },
    };
  }

  // @ts-ignore
  static get relationMappings() {
    return {
      createdTasks: {
        relation: BaseModel.HasManyRelation,
        modelClass: 'Task.cjs',

        join: {
          from: 'users.id',
          to: 'tasks.creatorId',
        },
      },
      assignedTasks: {
        relation: BaseModel.HasManyRelation,
        modelClass: 'Task.cjs',

        join: {
          from: 'users.id',
          to: 'tasks.executorId',
        },
      },
    };
  }

  // @ts-ignore
  set password(value) {
    this.passwordDigest = encrypt(value);
  }

  // @ts-ignore
  get name() {
    return this.fullName();
  }

  verifyPassword(password) {
    return encrypt(password) === this.passwordDigest;
  }
};
