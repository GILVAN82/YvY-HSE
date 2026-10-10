module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    customLaunchers: {
      ChromeHeadlessSafe: {
        base: 'ChromeHeadless',
        flags: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
      },
    },
  });
};
