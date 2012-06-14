(function() {

  /*globals window*/

  // Grab local database implementation.
  var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  var IDBTransaction = window.IDBTransaction || window.mozIDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;

  // Define the Kinvey.Store.Local class.
  Kinvey.Store.Local = Base.extend({
    // Database handle.
    database: null,

    // Default options.
    options: {
      error: function() { },
      success: function() { }
    },

    /**
     * Kinvey.Store.Local
     * 
     * @name Kinvey.Store.Local
     * @constructor
     * @param {string} collection Collection name.
     * @param {Object} [options]
     */
    constructor: function(collection, options) {
      this.collection = collection.replace('-', '_');
      this.name = 'Kinvey.' + Kinvey.appKey;// database name.

      // Options.
      options && this.configure(options);
    },

    /** @lends Kinvey.Store.Local# */

    /**
     * Aggregates objects from the store.
     * 
     * @param {Object} aggregation Aggregation object.
     * @param {Object} [options] Options.
     */
    aggregate: function(aggregation, options) {
      options = this._options(options);

      var msg = 'Aggregation is not supported by this store.';
      options.error({
        error: msg,
        message: msg
      }, {});
    },

    /**
     * Configures store.
     * 
     * @param {Object} options
     * @param {function(response, info)} [options.success] Success callback.
     * @param {function(error, info)} [options.error] Failure callback.
     */
    configure: function(options) {
      options.error && (this.options.error = options.error);
      options.success && (this.options.success = options.success);
    },

    /**
     * Logs in user.
     * 
     * @param {Object} object
     * @param {Object} [options] Options.
     */
    login: function(object, options) {
      options = this._options(options);

      var msg = 'Logging in is not supported by this store.';
      options.error({
        error: msg,
        message: msg
      }, {});
    },

    /**
     * Queries the store for a specific object.
     * 
     * @param {string} id Object id.
     * @param {Object} [options] Options.
     */
    query: function(id, options) {
      options = this._options(options);

      // Convenience shortcut.
      var c = this.collection;
      var errorMsg = 'Not found';

      this._db({
        success: bind(this, function(db) {
          // First pass; check whether collection exists.
          if(!db.objectStoreNames.contains(c)) {
            options.error({
              error: errorMsg,
              message: errorMsg
            }, {});
            return;
          }

          // Second pass; check whether entity exists.
          var store = db.transaction([c], IDBTransaction.READ_ONLY).objectStore(c);
          var tnx = store.get(id);
          tnx.onsuccess = tnx.onerror = function() {
            // Success handler is also fired when entity is not found. Check here.
            null != tnx.result ? options.success(tnx.result, {}) : options.error({
              error: tnx.error || errorMsg,
              message: tnx.error || errorMsg
            }, {});
          };
        }),
        error: options.error
      });
    },

    /**
     * Queries the store for multiple objects.
     * 
     * @param {Object} query Query object.
     * @param {Object} [options] Options.
     */
    queryWithQuery: function(query, options) {
      options = this._options(options);

      var msg = 'Querying is not supported by this store.';
      options.error({
        error: msg,
        message: msg
      }, {});
    },

    /**
     * Removes object from the store.
     * 
     * @param {Object} object Object to be removed.
     * @param {Object} [options] Options.
     */
    remove: function(object, options) {
      options = this._options(options);

      // Convenience shortcut.
      var c = this.collection;

      this._db({
        success: bind(this, function(db) {
          // First pass; check whether collection exists.
          if(!db.objectStoreNames.contains(c)) {
            options.success(null, {});
            return;
          }

          // Second pass; check whether entity exists.
          var store = db.transaction([c], IDBTransaction.READ_WRITE).objectStore(c);
          var tnx = store['delete'](object._id);
          tnx.onsuccess = function() {
            options.success(null, {});
          };
          tnx.onerror = function() {
            options.error({
              error: tnx.error,
              message: tnx.error
            }, {});
          };
        }),
        error: options.error
      });
    },

    /**
     * Removes multiple objects from the store.
     * 
     * @param {Object} query Query object.
     * @param {Object} [options] Options.
     */
    removeWithQuery: function(query, options) {
      options = this._options(options);

      var msg = 'Querying is not supported by this store.';
      options.error({
        error: msg,
        message: msg
      }, {});
    },

    /**
     * Saves object to the store.
     * 
     * @param {Object} object Object to be saved.
     * @param {Object} [options] Options.
     */
    save: function(object, options) {
      options = this._options(options);

      // Convenience shortcut.
      var c = this.collection;

      this._db({
        success: bind(this, function(db) {
          // First pass, create the collection if not existent. This operation is
          // performed through a versionchange transaction.
          if(!db.objectStoreNames.contains(c)) {
            // Create collection by migrating the database.
            this._migrate(db, function(db) {
              // Command to be executed on versionchange.
              db.createObjectStore(c, { keyPath: '_id' });
            }, {
              success: bind(this, function(db) {
                // Collection created, proceed with saving.
                this._save(db, object, options);
              }),
              error: options.error
            });
          }
          else {
            // Collection already exists, proceed with saving.
            this._save(db, object, options);
          }
        }),
        error: options.error
      });
    },

    /**
     * Returns database handle.
     * 
     * @private
     * @param {Object} options Options.
     */
    _db: function(options) {
      // Return if already openend.
      if(this.database && !options.version) {
        options.success(this.database);
        return;
      }

      // Open database.
      var request = options.version ? indexedDB.open(this.name, options.version) : indexedDB.open(this.name);
      request.onupgradeneeded = bind(this, function() {
        this.database = request.result;
        options.migrate && options.migrate(this.database);
      });
      request.onsuccess = bind(this, function() {
        this.database = request.result;

        // onversionchange is called when another thread migrates the same
        // database. Avoid blocking by closing and unsetting our instance.
        this.database.onversionchange = bind(this, function() {
          this.database.close();
          this.database = null;
        });
        options.success(this.database);
      });
      request.onerror = request.onblocked = function() {
        options.error({
          error: request.error,
          message: request.error
        }, {});
      };
    },

    /**
     * Migrates database.
     * 
     * @private
     * @param {function(database)} command Migration command.
     * @param {Object} options Options.
     */
    _migrate: function(db, command, options) {
      // Increment version number.
      var version = parseInt(db.version || 0, 10) + 1;

      // Earlier versions of the IndexedDB spec defines setVersion as the way
      // to migrate. Later versions require the onupgradeevent. We support both.
      if(db.setVersion) {//old
        var versionRequest = db.setVersion(version);
        versionRequest.onsuccess = function() {
          command(db);
          options.success(db);
        };
        versionRequest.onerror = function() {
          options.error({
            error: versionRequest.error,
            message: versionRequest.error
          }, {});
        };
        return;
      }

      // Otherwise, reopen the database.
      options.migrate = command;
      options.version = version;
      this._db(options);
    },

    /**
     * Returns complete options object.
     * 
     * @param {Object} options Options.
     * @return {Object} Options.
     */
    _options: function(options) {
      options || (options = {});
      options.success || (options.success = this.options.success);
      options.error || (options.error = this.options.error);
      return options;
    },

    /**
     * Saves entity to the store.
     * 
     * @private
     * @param {Object} db Database handle.
     * @param {Object} object Object to be saved.
     * @param {Object} options Options.
     */
    _save: function(db, object, options) {
      var c = this.collection;
      var store = db.transaction([c], IDBTransaction.READ_WRITE).objectStore(c);

      // If entity is new, assign an ID. This is done because IndexedDB uses
      // simple integers, and we need something more robust.
      object._id || (object._id = new Date().getTime().toString());

      // Save to collection.
      var tnx = store.put(object);
      tnx.onsuccess = function() {
        options.success(object, {});
      };
      tnx.onerror = function() {
        options.error({
          error: tnx.error,
          message: tnx.error
        }, {});
      };
    }
  });

}());