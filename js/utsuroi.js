var Utsuroi = (function (exports, THREE) {
	'use strict';

	var THREE__default = 'default' in THREE ? THREE['default'] : THREE;

	var version = '18.5.0';

	/**
	 * Tween.js - Licensed under the MIT license
	 * https://github.com/tweenjs/tween.js
	 * ----------------------------------------------
	 *
	 * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
	 * Thank you all, you're awesome!
	 */


	var _Group = function () {
		this._tweens = {};
		this._tweensAddedDuringUpdate = {};
	};

	_Group.prototype = {
		getAll: function () {

			return Object.keys(this._tweens).map(function (tweenId) {
				return this._tweens[tweenId];
			}.bind(this));

		},

		removeAll: function () {

			this._tweens = {};

		},

		add: function (tween) {

			this._tweens[tween.getId()] = tween;
			this._tweensAddedDuringUpdate[tween.getId()] = tween;

		},

		remove: function (tween) {

			delete this._tweens[tween.getId()];
			delete this._tweensAddedDuringUpdate[tween.getId()];

		},

		update: function (time, preserve) {

			var tweenIds = Object.keys(this._tweens);

			if (tweenIds.length === 0) {
				return false;
			}

			time = time !== undefined ? time : TWEEN.now();

			// Tweens are updated in "batches". If you add a new tween during an
			// update, then the new tween will be updated in the next batch.
			// If you remove a tween during an update, it may or may not be updated.
			// However, if the removed tween was added during the current batch,
			// then it will not be updated.
			while (tweenIds.length > 0) {
				this._tweensAddedDuringUpdate = {};

				for (var i = 0; i < tweenIds.length; i++) {

					var tween = this._tweens[tweenIds[i]];

					if (tween && tween.update(time) === false) {
						tween._isPlaying = false;

						if (!preserve) {
							delete this._tweens[tweenIds[i]];
						}
					}
				}

				tweenIds = Object.keys(this._tweensAddedDuringUpdate);
			}

			return true;

		}
	};

	var TWEEN = new _Group();

	TWEEN.Group = _Group;
	TWEEN._nextId = 0;
	TWEEN.nextId = function () {
		return TWEEN._nextId++;
	};


	// Include a performance.now polyfill.
	// In node.js, use process.hrtime.
	if (typeof (self) === 'undefined' && typeof (process) !== 'undefined' && process.hrtime) {
		TWEEN.now = function () {
			var time = process.hrtime();

			// Convert [seconds, nanoseconds] to milliseconds.
			return time[0] * 1000 + time[1] / 1000000;
		};
	}
	// In a browser, use self.performance.now if it is available.
	else if (typeof (self) !== 'undefined' &&
	         self.performance !== undefined &&
			 self.performance.now !== undefined) {
		// This must be bound, because directly assigning this function
		// leads to an invocation exception in Chrome.
		TWEEN.now = self.performance.now.bind(self.performance);
	}
	// Use Date.now if it is available.
	else if (Date.now !== undefined) {
		TWEEN.now = Date.now;
	}
	// Otherwise, use 'new Date().getTime()'.
	else {
		TWEEN.now = function () {
			return new Date().getTime();
		};
	}


	TWEEN.Tween = function (object, group) {
		this._isPaused = false;
		this._pauseStart = null;
		this._object = object;
		this._valuesStart = {};
		this._valuesEnd = {};
		this._valuesStartRepeat = {};
		this._duration = 1000;
		this._repeat = 0;
		this._repeatDelayTime = undefined;
		this._yoyo = false;
		this._isPlaying = false;
		this._reversed = false;
		this._delayTime = 0;
		this._startTime = null;
		this._easingFunction = TWEEN.Easing.Linear.None;
		this._interpolationFunction = TWEEN.Interpolation.Linear;
		this._chainedTweens = [];
		this._onStartCallback = null;
		this._onStartCallbackFired = false;
		this._onUpdateCallback = null;
		this._onRepeatCallback = null;
		this._onCompleteCallback = null;
		this._onStopCallback = null;
		this._group = group || TWEEN;
		this._id = TWEEN.nextId();

	};

	TWEEN.Tween.prototype = {
		getId: function () {
			return this._id;
		},

		isPlaying: function () {
			return this._isPlaying;
		},

		isPaused: function () {
			return this._isPaused;
		},

		to: function (properties, duration) {

			this._valuesEnd = Object.create(properties);

			if (duration !== undefined) {
				this._duration = duration;
			}

			return this;

		},

		duration: function duration(d) {
			this._duration = d;
			return this;
		},

		start: function (time) {

			this._group.add(this);

			this._isPlaying = true;

			this._isPaused = false;

			this._onStartCallbackFired = false;

			this._startTime = time !== undefined ? typeof time === 'string' ? TWEEN.now() + parseFloat(time) : time : TWEEN.now();
			this._startTime += this._delayTime;

			for (var property in this._valuesEnd) {

				// Check if an Array was provided as property value
				if (this._valuesEnd[property] instanceof Array) {

					if (this._valuesEnd[property].length === 0) {
						continue;
					}

					// Create a local copy of the Array with the start value at the front
					this._valuesEnd[property] = [this._object[property]].concat(this._valuesEnd[property]);

				}

				// If `to()` specifies a property that doesn't exist in the source object,
				// we should not set that property in the object
				if (this._object[property] === undefined) {
					continue;
				}

				// Save the starting value, but only once.
				if (typeof(this._valuesStart[property]) === 'undefined') {
					this._valuesStart[property] = this._object[property];
				}

				if ((this._valuesStart[property] instanceof Array) === false) {
					this._valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
				}

				this._valuesStartRepeat[property] = this._valuesStart[property] || 0;

			}

			return this;

		},

		stop: function () {

			if (!this._isPlaying) {
				return this;
			}

			this._group.remove(this);

			this._isPlaying = false;

			this._isPaused = false;

			if (this._onStopCallback !== null) {
				this._onStopCallback(this._object);
			}

			this.stopChainedTweens();
			return this;

		},

		end: function () {

			this.update(Infinity);
			return this;

		},

		pause: function(time) {

			if (this._isPaused || !this._isPlaying) {
				return this;
			}

			this._isPaused = true;

			this._pauseStart = time === undefined ? TWEEN.now() : time;

			this._group.remove(this);

			return this;

		},

		resume: function(time) {

			if (!this._isPaused || !this._isPlaying) {
				return this;
			}

			this._isPaused = false;

			this._startTime += (time === undefined ? TWEEN.now() : time)
				- this._pauseStart;

			this._pauseStart = 0;

			this._group.add(this);

			return this;

		},

		stopChainedTweens: function () {

			for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
				this._chainedTweens[i].stop();
			}

		},

		group: function (group) {
			this._group = group;
			return this;
		},

		delay: function (amount) {

			this._delayTime = amount;
			return this;

		},

		repeat: function (times) {

			this._repeat = times;
			return this;

		},

		repeatDelay: function (amount) {

			this._repeatDelayTime = amount;
			return this;

		},

		yoyo: function (yoyo) {

			this._yoyo = yoyo;
			return this;

		},

		easing: function (easingFunction) {

			this._easingFunction = easingFunction;
			return this;

		},

		interpolation: function (interpolationFunction) {

			this._interpolationFunction = interpolationFunction;
			return this;

		},

		chain: function () {

			this._chainedTweens = arguments;
			return this;

		},

		onStart: function (callback) {

			this._onStartCallback = callback;
			return this;

		},

		onUpdate: function (callback) {

			this._onUpdateCallback = callback;
			return this;

		},

		onRepeat: function onRepeat(callback) {

			this._onRepeatCallback = callback;
			return this;

		},

		onComplete: function (callback) {

			this._onCompleteCallback = callback;
			return this;

		},

		onStop: function (callback) {

			this._onStopCallback = callback;
			return this;

		},

		update: function (time) {

			var property;
			var elapsed;
			var value;

			if (time < this._startTime) {
				return true;
			}

			if (this._onStartCallbackFired === false) {

				if (this._onStartCallback !== null) {
					this._onStartCallback(this._object);
				}

				this._onStartCallbackFired = true;
			}

			elapsed = (time - this._startTime) / this._duration;
			elapsed = (this._duration === 0 || elapsed > 1) ? 1 : elapsed;

			value = this._easingFunction(elapsed);

			for (property in this._valuesEnd) {

				// Don't update properties that do not exist in the source object
				if (this._valuesStart[property] === undefined) {
					continue;
				}

				var start = this._valuesStart[property] || 0;
				var end = this._valuesEnd[property];

				if (end instanceof Array) {

					this._object[property] = this._interpolationFunction(end, value);

				} else {

					// Parses relative end values with start as base (e.g.: +10, -3)
					if (typeof (end) === 'string') {

						if (end.charAt(0) === '+' || end.charAt(0) === '-') {
							end = start + parseFloat(end);
						} else {
							end = parseFloat(end);
						}
					}

					// Protect against non numeric properties.
					if (typeof (end) === 'number') {
						this._object[property] = start + (end - start) * value;
					}

				}

			}

			if (this._onUpdateCallback !== null) {
				this._onUpdateCallback(this._object, elapsed);
			}

			if (elapsed === 1) {

				if (this._repeat > 0) {

					if (isFinite(this._repeat)) {
						this._repeat--;
					}

					// Reassign starting values, restart by making startTime = now
					for (property in this._valuesStartRepeat) {

						if (typeof (this._valuesEnd[property]) === 'string') {
							this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property]);
						}

						if (this._yoyo) {
							var tmp = this._valuesStartRepeat[property];

							this._valuesStartRepeat[property] = this._valuesEnd[property];
							this._valuesEnd[property] = tmp;
						}

						this._valuesStart[property] = this._valuesStartRepeat[property];

					}

					if (this._yoyo) {
						this._reversed = !this._reversed;
					}

					if (this._repeatDelayTime !== undefined) {
						this._startTime = time + this._repeatDelayTime;
					} else {
						this._startTime = time + this._delayTime;
					}

					if (this._onRepeatCallback !== null) {
						this._onRepeatCallback(this._object);
					}

					return true;

				} else {

					if (this._onCompleteCallback !== null) {

						this._onCompleteCallback(this._object);
					}

					for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
						// Make the chained tweens start exactly at the time they should,
						// even if the `update()` method was called way past the duration of the tween
						this._chainedTweens[i].start(this._startTime + this._duration);
					}

					return false;

				}

			}

			return true;

		}
	};


	TWEEN.Easing = {

		Linear: {

			None: function (k) {

				return k;

			}

		},

		Quadratic: {

			In: function (k) {

				return k * k;

			},

			Out: function (k) {

				return k * (2 - k);

			},

			InOut: function (k) {

				if ((k *= 2) < 1) {
					return 0.5 * k * k;
				}

				return - 0.5 * (--k * (k - 2) - 1);

			}

		},

		Cubic: {

			In: function (k) {

				return k * k * k;

			},

			Out: function (k) {

				return --k * k * k + 1;

			},

			InOut: function (k) {

				if ((k *= 2) < 1) {
					return 0.5 * k * k * k;
				}

				return 0.5 * ((k -= 2) * k * k + 2);

			}

		},

		Quartic: {

			In: function (k) {

				return k * k * k * k;

			},

			Out: function (k) {

				return 1 - (--k * k * k * k);

			},

			InOut: function (k) {

				if ((k *= 2) < 1) {
					return 0.5 * k * k * k * k;
				}

				return - 0.5 * ((k -= 2) * k * k * k - 2);

			}

		},

		Quintic: {

			In: function (k) {

				return k * k * k * k * k;

			},

			Out: function (k) {

				return --k * k * k * k * k + 1;

			},

			InOut: function (k) {

				if ((k *= 2) < 1) {
					return 0.5 * k * k * k * k * k;
				}

				return 0.5 * ((k -= 2) * k * k * k * k + 2);

			}

		},

		Sinusoidal: {

			In: function (k) {

				return 1 - Math.cos(k * Math.PI / 2);

			},

			Out: function (k) {

				return Math.sin(k * Math.PI / 2);

			},

			InOut: function (k) {

				return 0.5 * (1 - Math.cos(Math.PI * k));

			}

		},

		Exponential: {

			In: function (k) {

				return k === 0 ? 0 : Math.pow(1024, k - 1);

			},

			Out: function (k) {

				return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);

			},

			InOut: function (k) {

				if (k === 0) {
					return 0;
				}

				if (k === 1) {
					return 1;
				}

				if ((k *= 2) < 1) {
					return 0.5 * Math.pow(1024, k - 1);
				}

				return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);

			}

		},

		Circular: {

			In: function (k) {

				return 1 - Math.sqrt(1 - k * k);

			},

			Out: function (k) {

				return Math.sqrt(1 - (--k * k));

			},

			InOut: function (k) {

				if ((k *= 2) < 1) {
					return - 0.5 * (Math.sqrt(1 - k * k) - 1);
				}

				return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);

			}

		},

		Elastic: {

			In: function (k) {

				if (k === 0) {
					return 0;
				}

				if (k === 1) {
					return 1;
				}

				return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);

			},

			Out: function (k) {

				if (k === 0) {
					return 0;
				}

				if (k === 1) {
					return 1;
				}

				return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;

			},

			InOut: function (k) {

				if (k === 0) {
					return 0;
				}

				if (k === 1) {
					return 1;
				}

				k *= 2;

				if (k < 1) {
					return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
				}

				return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;

			}

		},

		Back: {

			In: function (k) {

				var s = 1.70158;

				return k * k * ((s + 1) * k - s);

			},

			Out: function (k) {

				var s = 1.70158;

				return --k * k * ((s + 1) * k + s) + 1;

			},

			InOut: function (k) {

				var s = 1.70158 * 1.525;

				if ((k *= 2) < 1) {
					return 0.5 * (k * k * ((s + 1) * k - s));
				}

				return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);

			}

		},

		Bounce: {

			In: function (k) {

				return 1 - TWEEN.Easing.Bounce.Out(1 - k);

			},

			Out: function (k) {

				if (k < (1 / 2.75)) {
					return 7.5625 * k * k;
				} else if (k < (2 / 2.75)) {
					return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
				} else if (k < (2.5 / 2.75)) {
					return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
				} else {
					return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
				}

			},

			InOut: function (k) {

				if (k < 0.5) {
					return TWEEN.Easing.Bounce.In(k * 2) * 0.5;
				}

				return TWEEN.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;

			}

		}

	};

	TWEEN.Interpolation = {

		Linear: function (v, k) {

			var m = v.length - 1;
			var f = m * k;
			var i = Math.floor(f);
			var fn = TWEEN.Interpolation.Utils.Linear;

			if (k < 0) {
				return fn(v[0], v[1], f);
			}

			if (k > 1) {
				return fn(v[m], v[m - 1], m - f);
			}

			return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);

		},

		Bezier: function (v, k) {

			var b = 0;
			var n = v.length - 1;
			var pw = Math.pow;
			var bn = TWEEN.Interpolation.Utils.Bernstein;

			for (var i = 0; i <= n; i++) {
				b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
			}

			return b;

		},

		CatmullRom: function (v, k) {

			var m = v.length - 1;
			var f = m * k;
			var i = Math.floor(f);
			var fn = TWEEN.Interpolation.Utils.CatmullRom;

			if (v[0] === v[m]) {

				if (k < 0) {
					i = Math.floor(f = m * (1 + k));
				}

				return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);

			} else {

				if (k < 0) {
					return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
				}

				if (k > 1) {
					return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
				}

				return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);

			}

		},

		Utils: {

			Linear: function (p0, p1, t) {

				return (p1 - p0) * t + p0;

			},

			Bernstein: function (n, i) {

				var fc = TWEEN.Interpolation.Utils.Factorial;

				return fc(n) / fc(i) / fc(n - i);

			},

			Factorial: (function () {

				var a = [1];

				return function (n) {

					var s = 1;

					if (a[n]) {
						return a[n];
					}

					for (var i = n; i > 1; i--) {
						s *= i;
					}

					a[n] = s;
					return s;

				};

			})(),

			CatmullRom: function (p0, p1, p2, p3, t) {

				var v0 = (p2 - p0) * 0.5;
				var v1 = (p3 - p1) * 0.5;
				var t2 = t * t;
				var t3 = t * t2;

				return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (- 3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;

			}

		}

	};
	TWEEN.version = version;

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var eventemitter3 = createCommonjsModule(function (module) {

	var has = Object.prototype.hasOwnProperty
	  , prefix = '~';

	/**
	 * Constructor to create a storage for our `EE` objects.
	 * An `Events` instance is a plain object whose properties are event names.
	 *
	 * @constructor
	 * @private
	 */
	function Events() {}

	//
	// We try to not inherit from `Object.prototype`. In some engines creating an
	// instance in this way is faster than calling `Object.create(null)` directly.
	// If `Object.create(null)` is not supported we prefix the event names with a
	// character to make sure that the built-in object properties are not
	// overridden or used as an attack vector.
	//
	if (Object.create) {
	  Events.prototype = Object.create(null);

	  //
	  // This hack is needed because the `__proto__` property is still inherited in
	  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
	  //
	  if (!new Events().__proto__) prefix = false;
	}

	/**
	 * Representation of a single event listener.
	 *
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	 * @constructor
	 * @private
	 */
	function EE(fn, context, once) {
	  this.fn = fn;
	  this.context = context;
	  this.once = once || false;
	}

	/**
	 * Add a listener for a given event.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} once Specify if the listener is a one-time listener.
	 * @returns {EventEmitter}
	 * @private
	 */
	function addListener(emitter, event, fn, context, once) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('The listener must be a function');
	  }

	  var listener = new EE(fn, context || emitter, once)
	    , evt = prefix ? prefix + event : event;

	  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
	  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
	  else emitter._events[evt] = [emitter._events[evt], listener];

	  return emitter;
	}

	/**
	 * Clear event by name.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} evt The Event name.
	 * @private
	 */
	function clearEvent(emitter, evt) {
	  if (--emitter._eventsCount === 0) emitter._events = new Events();
	  else delete emitter._events[evt];
	}

	/**
	 * Minimal `EventEmitter` interface that is molded against the Node.js
	 * `EventEmitter` interface.
	 *
	 * @constructor
	 * @public
	 */
	function EventEmitter() {
	  this._events = new Events();
	  this._eventsCount = 0;
	}

	/**
	 * Return an array listing the events for which the emitter has registered
	 * listeners.
	 *
	 * @returns {Array}
	 * @public
	 */
	EventEmitter.prototype.eventNames = function eventNames() {
	  var names = []
	    , events
	    , name;

	  if (this._eventsCount === 0) return names;

	  for (name in (events = this._events)) {
	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
	  }

	  if (Object.getOwnPropertySymbols) {
	    return names.concat(Object.getOwnPropertySymbols(events));
	  }

	  return names;
	};

	/**
	 * Return the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Array} The registered listeners.
	 * @public
	 */
	EventEmitter.prototype.listeners = function listeners(event) {
	  var evt = prefix ? prefix + event : event
	    , handlers = this._events[evt];

	  if (!handlers) return [];
	  if (handlers.fn) return [handlers.fn];

	  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
	    ee[i] = handlers[i].fn;
	  }

	  return ee;
	};

	/**
	 * Return the number of listeners listening to a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Number} The number of listeners.
	 * @public
	 */
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
	  var evt = prefix ? prefix + event : event
	    , listeners = this._events[evt];

	  if (!listeners) return 0;
	  if (listeners.fn) return 1;
	  return listeners.length;
	};

	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Boolean} `true` if the event had listeners, else `false`.
	 * @public
	 */
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return false;

	  var listeners = this._events[evt]
	    , len = arguments.length
	    , args
	    , i;

	  if (listeners.fn) {
	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

	    switch (len) {
	      case 1: return listeners.fn.call(listeners.context), true;
	      case 2: return listeners.fn.call(listeners.context, a1), true;
	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
	    }

	    for (i = 1, args = new Array(len -1); i < len; i++) {
	      args[i - 1] = arguments[i];
	    }

	    listeners.fn.apply(listeners.context, args);
	  } else {
	    var length = listeners.length
	      , j;

	    for (i = 0; i < length; i++) {
	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

	      switch (len) {
	        case 1: listeners[i].fn.call(listeners[i].context); break;
	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
	        default:
	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
	            args[j - 1] = arguments[j];
	          }

	          listeners[i].fn.apply(listeners[i].context, args);
	      }
	    }
	  }

	  return true;
	};

	/**
	 * Add a listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.on = function on(event, fn, context) {
	  return addListener(this, event, fn, context, false);
	};

	/**
	 * Add a one-time listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.once = function once(event, fn, context) {
	  return addListener(this, event, fn, context, true);
	};

	/**
	 * Remove the listeners of a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn Only remove the listeners that match this function.
	 * @param {*} context Only remove the listeners that have this context.
	 * @param {Boolean} once Only remove one-time listeners.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return this;
	  if (!fn) {
	    clearEvent(this, evt);
	    return this;
	  }

	  var listeners = this._events[evt];

	  if (listeners.fn) {
	    if (
	      listeners.fn === fn &&
	      (!once || listeners.once) &&
	      (!context || listeners.context === context)
	    ) {
	      clearEvent(this, evt);
	    }
	  } else {
	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
	      if (
	        listeners[i].fn !== fn ||
	        (once && !listeners[i].once) ||
	        (context && listeners[i].context !== context)
	      ) {
	        events.push(listeners[i]);
	      }
	    }

	    //
	    // Reset the array, or remove it completely if we have no more listeners.
	    //
	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
	    else clearEvent(this, evt);
	  }

	  return this;
	};

	/**
	 * Remove all listeners, or those of the specified event.
	 *
	 * @param {(String|Symbol)} [event] The event name.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
	  var evt;

	  if (event) {
	    evt = prefix ? prefix + event : event;
	    if (this._events[evt]) clearEvent(this, evt);
	  } else {
	    this._events = new Events();
	    this._eventsCount = 0;
	  }

	  return this;
	};

	//
	// Alias methods names because people roll like that.
	//
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;

	//
	// Expose the prefix.
	//
	EventEmitter.prefixed = prefix;

	//
	// Allow `EventEmitter` to be imported as module namespace.
	//
	EventEmitter.EventEmitter = EventEmitter;

	//
	// Expose the module.
	//
	{
	  module.exports = EventEmitter;
	}
	});
	var eventemitter3_1 = eventemitter3.EventEmitter;

	class Action {
	    constructor(actionData) {
	        this.weight = 0;
	        this.getWeight = () => { return this.weight; };
	        this.setLoop = (val) => {
	            this.actionData.loop = val ? THREE.LoopRepeat : THREE.LoopOnce;
	        };
	        this.name = actionData.getClip().name;
	        this.actionData = actionData;
	        this.actionData.setEffectiveWeight(0);
	    }
	    getName() { return this.name; }
	    setWeight(val) {
	        if (val < 0)
	            val = 0;
	        if (1 < val)
	            val = 1;
	        this.weight = val;
	        this.actionData.setEffectiveWeight(val);
	    }
	    play() {
	        this.actionData.play();
	    }
	    reset() {
	        this.actionData.reset();
	    }
	}

	class Manipulator extends eventemitter3 {
	    constructor(scene, animations) {
	        super();
	        this.clock = new THREE__default.Clock();
	        this.animationEnabled = false;
	        this.actions = [];
	        this.clock = new THREE__default.Clock();
	        this.mixer = new THREE__default.AnimationMixer(scene);
	        this.actions = animations.map((animationClip) => {
	            let action = this.mixer.clipAction(animationClip);
	            return new Action(action);
	        });
	    }
	    get currentActionName() {
	        return this.currentAction && this.currentAction.getName();
	    }
	    findAction(name) {
	        return this.actions.find((action) => {
	            return action.getName() === name;
	        });
	    }
	    to(actionName, duration, loop = false) {
	        const oldAction = this.currentAction;
	        const newAction = this.findAction(actionName);
	        if (!newAction) {
	            console.warn(`${actionName} is not found`);
	            return;
	        }
	        this.emit('changeStart', {
	            from: oldAction && oldAction.getName(),
	            to: newAction.getName()
	        });
	        this.currentAction = newAction;
	        newAction.setLoop(loop);
	        newAction.reset();
	        newAction.play();
	        const param = { weight: 0 };
	        const tween = new TWEEN.Tween(param)
	            .to({ weight: 1 }, duration)
	            .onUpdate(function () {
	            if (oldAction) {
	                oldAction.setWeight(1 - param.weight);
	            }
	            newAction.setWeight(param.weight);
	        })
	            .onComplete(() => {
	            this.emit('changeComplete', {
	                from: oldAction && oldAction.getName(),
	                to: newAction.getName()
	            });
	        });
	        tween.start();
	    }
	    play(actionName, loop = false) {
	        this.animationEnabled = true;
	        if (actionName) {
	            this.to(actionName, 0, loop);
	        }
	    }
	    pause() {
	        this.animationEnabled = true;
	    }
	    update() {
	        if (!this.animationEnabled)
	            return;
	        let delta = this.clock.getDelta();
	        this.mixer.update(delta);
	        TWEEN.update();
	    }
	}

	exports.Action = Action;
	exports.Manipulator = Manipulator;

	return exports;

}({}, THREE));
