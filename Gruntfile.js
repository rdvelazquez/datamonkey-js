module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['assets/js/hivtrace/*.js'],
        dest: 'public/assets/js/hivtrace.js'
      }
    },
    mochaTest: {
      test: {
          src: ['tests/hivtrace.js'],
          options: {
                run: true,
              },
          },
    },
    watch: {
      //files: ['assets/js/**/*.js'],
      files: ['app/**/*.js', 'tests/*.js'],
      tasks: ['mochaTest']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['concat']);
  grunt.registerTask('default', ['mochaTest']);

};