// @ts-check

export default {
  translation: {
    appName: 'JUST DO IT',
    title: 'Your Task Manager',
    flash: {
      session: {
        create: {
          success: 'You are logged in',
          error: 'Wrong email or password',
        },
        delete: {
          success: 'You are logged out',
        },
      },
      users: {
        create: {
          error: 'Failed to register',
          success: 'User successfully registered',
        },
      },
      authError: 'Access is denied! Please log in.',
    },
    layouts: {
      application: {
        home: 'Home',
        users: 'Users',
        signIn: 'Login',
        signUp: 'Registration',
        signOut: 'Exit',
      },
    },
    views: {
      session: {
        new: {
          signIn: 'Login',
          submit: 'Log in',
        },
      },
      users: {
        id: 'ID',
        firstName: 'First name',
        lastName: 'Last name',
        fullName: 'Name',
        email: 'Email',
        createdAt: 'Creation date',
        new: {
          submit: 'Save',
          signUp: 'Registration',
        },
      },
      welcome: {
        index: {
          hello: 'Hi, this is your "JUST DO IT" Task Manager!',
          description: 'A programming project from Hexlet!',
          more: 'Learn More',
        },
      },
    },
  },
};
