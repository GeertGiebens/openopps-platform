// Nav
//
// Note we need to take special care to not open up this view multiple times.
// Bootstrap modals do work with multiple modal opens, and that wouldn't make
// sense anyway. We do that via a variable here (doingLogin) that bypasses
// the render here, and is reset by a callback when the modal closes later.
var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
var UIConfig = require('../../../config/ui.json');
var Login = require('../../../config/login.json');
var LoginController = require('../../login/controllers/login_controller');
var NavTemplate = require('../templates/nav_template.html');
var IdleModal = require('../../../components/modal_idle');
var User = require('../../../../utils/user');

var NavView = Backbone.View.extend({
  events: {
    'click .navbar-brand': linkBackbone,
    'click .nav-link': linkBackbone,
    'click .login': 'loginClick',
    'click .logout': 'logout',
    'click .menu-toggle': 'toggleMenu'
  },

  initialize: function (options) {
    var self = this;
    this.options = options;

    this.listenTo(window.cache.userEvents, 'user:login:success', function (userData) {
      self.doRender({ user: userData });
      this.idleModal = new IdleModal({ el: '#login-wrapper' }).render();
      this.idleModal.resetTimeout();
    });

    this.listenTo(window.cache.userEvents, 'user:login:close', function () {
      self.doingLogin = false;
    });

    this.listenTo(window.cache.userEvents, 'user:request:logout', function () {
      if(this.idleModal) this.idleModal.cleanup();
      self.logout({});
    });

    this.listenTo(window.cache.userEvents, 'user:logout', function () {
      self.doRender({ user: null });
      Backbone.history.navigate('', {trigger: true});
      this.idleModal.cleanup();
      window.cache.userEvents.trigger('user:logout:success');
    });

    // request that the user log in to see the page
    this.listenTo(window.cache.userEvents, 'user:request:login', function (message) {
      // trigger the login modal
      $.getJSON('/csrfToken', function (t) {
        $('meta[name="csrf-token"]').attr('content', t._csrf);
        self.login(message);
      });
    });

    // update the navbar when the profile changes
    this.listenTo(window.cache.userEvents, 'user:profile:save', function (data) {
      $.ajax({
        url: '/api/user',
        dataType: 'json',
      }).done(function (data) {
        // reset the currentUser object
        window.cache.currentUser = new User(data);
        // re-render the view
        self.render();
      });
    });

    // update the user's photo when they change it
    this.listenTo(window.cache.userEvents, 'user:profile:photo:save', function (url) {
      $('.navbar-people').attr('src', url);
    });
  },

  render: function () {
    var self = this;
    this.doRender({ user: window.cache.currentUser, systemName: window.cache.system.name });
    if(window.cache.currentUser) {
      this.idleModal = new IdleModal({ el: '#login-wrapper' }).render();
      this.idleModal.resetTimeout();
    }
    return this;
  },

  doRender: function (data) {
    data.login = Login;
    data.ui = UIConfig;
    var template = _.template(NavTemplate)(data);
    this.$el.html(template);
    this.$el.localize();
  },

  toggleMenu: function (e) {
    if (e.preventDefault) e.preventDefault();
    $('.usajobs-nav__account').attr('data-state', function (i, attr) {
      return attr == 'is-open' ? 'is-closed' : 'is-open';
    });
    $('.usajobs-nav__secondary-menu').attr('aria-expanded', function (i, attr) {
      return attr == 'true' ? 'false' : 'true';
    });
  },

  loginClick: function (e) {
    if (e.preventDefault) e.preventDefault();
    this.login();
  },

  login: function (message) {
    if (this.doingLogin) return; // login modal already open, skip!
    this.doingLogin = true;
    if (this.loginController) {
      this.loginController.cleanup();
    }

    this.loginController = new LoginController({
      el: '#login-wrapper',
      message: message,
      navigate: ($(location).attr('pathname') === '/'),
    });
  },

  logout: function (e) {
    if (e.preventDefault) e.preventDefault();
    $.ajax({
      url: '/api/auth/logout?json=true',
    }).done(function (success) {
      window.cache.currentUser = null;
      window.cache.userEvents.trigger('user:logout');
    }).fail(function (error) {
      // do nothing
    });
  },

  cleanup: function () {
    if (this.loginController) {
      this.loginController.cleanup();
    }
    if (this.idleModal) {
      this.idleModal.cleanup();
    }
    removeView(this);
  },
});

module.exports = NavView;
