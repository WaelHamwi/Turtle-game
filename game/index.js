
(function () {
    'use strict';

    function TurtleChar(outerContainerId, opt_config) {

        if (TurtleChar.instance_) {
            return TurtleChar.instance_;
        }
        TurtleChar.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;
        this.snackbarEl = null;
        this.detailsButton = this.outerContainerEl.querySelector('#details-button');

        this.config = opt_config || TurtleChar.config;

        this.dimensions = TurtleChar.defaultDimensions;

        this.canvas = null;
        this.canvasCtx = null;

        this.tRex = null;

        this.distanceMeter = null;
        this.distanceRan = 0;

        this.highestScore = 0;

        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / FPS;
        this.currentSpeed = this.config.SPEED;

        this.obstacles = [];

        this.activated = false;
        this.playing = false;
        this.crashed = false;
        this.paused = false;
        this.inverted = false;
        this.invertTimer = 0;
        this.resizeTimerId_ = null;

        this.playCount = 0;

        // Sound FX.
        this.audioBuffer = null;
        this.soundFx = {};


        this.audioContext = null;

        // Images.
        this.images = {};
        this.imagesLoaded = 0;

        if (this.isDisabled()) {
            this.setupDisabledTurtleChar();
        } else {
            this.loadImages();
        }
    }
    window['TurtleChar'] = TurtleChar;



    var DEFAULT_WIDTH = 600;


    var FPS = 20;


    var IS_HIDPI = window.devicePixelRatio > 1;


    var IS_IOS = /iPad|iPhone|iPod/.test(window.navigator.platform);


    var IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;

    /** @const */
    var IS_TOUCH_ENABLED = 'ontouchstart' in window;


    TurtleChar.config = {
        ACCELERATION: 0.001,
        BG_Tree_SPEED: 0.2,
        BOTTOM_PAD: 10,
        CLEAR_TIME: 3000,
        Tree_FREQUENCY: 1,
        GAMEOVER_CLEAR_TIME: 750,
        GAP_COEFFICIENT: 0.6,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        INVERT_FADE_DURATION: 12000,
        INVERT_DISTANCE: 700,
        MAX_BLINK_COUNT: 7,
        MAX_TreeS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        MAX_OBSTACLE_DUPLICATION: 2,
        MAX_SPEED: 13,
        MIN_JUMP_HEIGHT: 35,
        MOBILE_SPEED_COEFFICIENT: 1.2,
        RESOURCE_TEMPLATE_ID: 'audio-resources',
        SPEED: 6,
        SPEED_DROP_COEFFICIENT: 3
    };



    TurtleChar.defaultDimensions = {
        WIDTH: DEFAULT_WIDTH,
        HEIGHT: 150
    };



    TurtleChar.classes = {
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        ICON: 'icon-TurtleGame',
        INVERTED: 'inverted',
        SNACKBAR: 'snackbar',
        SNACKBAR_SHOW: 'snackbar-show',
        TOUCH_CONTROLLER: 'controller'
    };



    TurtleChar.spriteDefinition = {
        LDPI: {
            CACTUS_LARGE: { x: 332, y: 2 },
            CACTUS_SMALL: { x: 228, y: 2 },
            Tree: { x: 86, y: 2 },
            HORIZON: { x: 2, y: 54 },
            MOON: { x: 484, y: 2 },
            PTERODACTYL: { x: 134, y: 2 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 655, y: 2 },
            TREX: { x: 848, y: 2 },
            STAR: { x: 645, y: 2 }
        }
    };



    TurtleChar.sounds = {
        BUTTON_PRESS: 'TurtleGame-sound-press',
        HIT: 'TurtleGame-sound-hit'

    };


    TurtleChar.keycodes = {
        JUMP: { '32': 1 },  // Up, spacebar '38': 1

        RESTART: { '13': 1 },
        UP: { '39': 1 }
    };



    TurtleChar.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load'
    };


    TurtleChar.prototype = {

        isDisabled: function () {

            return false;
        },


        setupDisabledTurtleChar: function () {
            this.containerEl = document.createElement('div');
            this.containerEl.className = TurtleChar.classes.SNACKBAR;
            this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg');
            this.outerContainerEl.appendChild(this.containerEl);


            document.addEventListener(TurtleChar.events.KEYDOWN, function (e) {
                if (TurtleChar.keycodes.JUMP[e.keyCode]) {
                    this.containerEl.classList.add(TurtleChar.classes.SNACKBAR_SHOW);
                    document.querySelector('.icon').classList.add('icon-disabled');
                }
            } .bind(this));
        },


        RefreshDrawConfigSetting: function (setting, value) {
            if (setting in this.config && value != undefined) {
                this.config[setting] = value;

                switch (setting) {
                    case 'GRAVITY':
                    case 'MIN_JUMP_HEIGHT':
                    case 'SPEED_DROP_COEFFICIENT':
                        this.tRex.config[setting] = value;
                        break;
                    case 'INITIAL_JUMP_VELOCITY':
                        this.tRex.setJumpVelocity(value);
                        break;
                    case 'SPEED':
                        this.setSpeed(value);
                        break;
                }
            }
        },


        loadImages: function () {

            TurtleChar.imageSprite = document.getElementById('TurtleGame-resources-1x');
            this.spriteDef = TurtleChar.spriteDefinition.LDPI;


            if (TurtleChar.imageSprite.complete) {
                this.init();
            } else {

                TurtleChar.imageSprite.addEventListener(TurtleChar.events.LOAD,
                    this.init.bind(this));
            }
        },


        loadSounds: function () {
            
        },


        setSpeed: function (opt_speed) {
            var speed = opt_speed || this.currentSpeed;


            if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
                var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH *
                    this.config.MOBILE_SPEED_COEFFICIENT;
                this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
            } else if (opt_speed) {
                this.currentSpeed = opt_speed;
            }
        },


        init: function () {

            document.querySelector('.' + TurtleChar.classes.ICON).style.visibility =
                'hidden';

            this.adjustDimensions();
            this.setSpeed();

            this.containerEl = document.createElement('div');
            this.containerEl.className = TurtleChar.classes.CONTAINER;


            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, TurtleChar.classes.PLAYER);

            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();
            TurtleChar.RefreshDrawCanvasScaling(this.canvas);


            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions,
                this.config.GAP_COEFFICIENT);

            // Distance meter
            this.distanceMeter = new Dist(this.canvas,
                this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);


            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

            this.outerContainerEl.appendChild(this.containerEl);

            if (IS_MOBILE) {
                this.createTouchController();
            }

            this.startListening();
            this.RefreshDraw();

            window.addEventListener(TurtleChar.events.RESIZE,
                this.debounceResize.bind(this));
        },


        createTouchController: function () {
            this.touchController = document.createElement('div');
            this.touchController.className = TurtleChar.classes.TOUCH_CONTROLLER;
            this.outerContainerEl.appendChild(this.touchController);
        },


        debounceResize: function () {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ =
                    setInterval(this.adjustDimensions.bind(this), 250);
            }
        },


        adjustDimensions: function () {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;

            var boxStyles = window.getComputedStyle(this.outerContainerEl);
            var padding = Number(boxStyles.paddingLeft.substr(0,
                boxStyles.paddingLeft.length - 2));

            this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;


            if (this.canvas) {
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;

                TurtleChar.RefreshDrawCanvasScaling(this.canvas);

                this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                this.clearCanvas();
                this.horizon.RefreshDraw(0, 0, true);
                this.tRex.RefreshDraw(0);


                if (this.playing || this.crashed || this.paused) {
                    this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                    this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                    this.distanceMeter.RefreshDraw(0, Math.ceil(this.distanceRan));
                    this.stop();
                } else {
                    this.tRex.draw(0, 0);
                }

                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.RefreshDrawDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw();
                }
            }
        },


        playIntro: function () {
            if (!this.activated && !this.crashed) {
                this.playingIntro = true;
                this.tRex.playingIntro = true;


                var keyframes = '@-webkit-keyframes intro { ' +
                    'from { width:' + Trex.config.WIDTH + 'px }' +
                    'to { width: ' + this.dimensions.WIDTH + 'px }' +
                    '}';


                var sheet = document.createElement('style');
                sheet.innerHTML = keyframes;
                document.head.appendChild(sheet);

                this.containerEl.addEventListener(TurtleChar.events.ANIM_END,
                    this.beginRun.bind(this));

                this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both';
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';


                this.playing = true;
                this.activated = true;
                this.play();
            } else if (this.crashed) {
                this.restart();
            }
        },



        beginRun: function () {
            this.runningTime = 0;
            this.playingIntro = false;
            this.tRex.playingIntro = false;
            this.containerEl.style.webkitAnimation = '';
            this.playCount++;


            document.addEventListener(TurtleChar.events.VISIBILITY,
                this.onVisibilityChange.bind(this));

            window.addEventListener(TurtleChar.events.BLUR,
                this.onVisibilityChange.bind(this));

            window.addEventListener(TurtleChar.events.FOCUS,
                this.onVisibilityChange.bind(this));
        },

        clearCanvas: function () {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH,
                this.dimensions.HEIGHT);
        },

        RefreshDraw: function () {
            this.RefreshDrawPending = false;

            var now = getTimeStamp();
            var deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.clearCanvas();

                if (this.tRex.jumping) {
                    this.tRex.RefreshDrawJump(deltaTime);
                }

                this.runningTime += deltaTime;
                var hasObstacles = this.runningTime > this.config.CLEAR_TIME;


                if (this.tRex.jumpCount == 1 && !this.playingIntro) {
                    this.playIntro();
                }

                //  doesn't move until the in is over.
                if (this.playingIntro) {
                    this.horizon.RefreshDraw(0, this.currentSpeed, hasObstacles);
                } else {
                    deltaTime = !this.activated ? 0 : deltaTime;
                    this.horizon.RefreshDraw(deltaTime, this.currentSpeed, hasObstacles,
                        this.inverted);
                }

                // collisions.
                var collision = hasObstacles &&
                    checkForCollision(this.horizon.obstacles[0], this.tRex);

                if (!collision) {
                    this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

                    if (this.currentSpeed < this.config.MAX_SPEED) {
                        this.currentSpeed += this.config.ACCELERATION;
                    }
                } else {
                    this.gameOver();
                }

                var playAchievementSound = this.distanceMeter.RefreshDraw(deltaTime,
                    Math.ceil(this.distanceRan));

                if (playAchievementSound) {
                    this.playSound(this.soundFx.SCORE);
                }

                if (this.invertTimer) {
                    this.invertTimer += deltaTime;
                } else {
                    var actualDistance =
                        this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));

                    if (actualDistance > 0) {
                        this.invertTrigger = !(actualDistance %
                            this.config.INVERT_DISTANCE);

                        if (this.invertTrigger && this.invertTimer === 0) {
                            this.invertTimer += deltaTime;
                            this.invert();
                        }
                    }
                }
            }

            if (this.playing || (!this.activated &&
                this.tRex.blinkCount < TurtleChar.config.MAX_BLINK_COUNT)) {
                this.tRex.RefreshDraw(deltaTime);
                this.scheduleNextRefreshDraw();
            }
        },


        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.MOUSEDOWN:
                        this.onPress(e);
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.MOUSEUP:
                        this.outPress(e);
                        break;
                }
            } .bind(this))(e.type, TurtleChar.events);
        },

        startListening: function () {
            // Keys.
            document.addEventListener(TurtleChar.events.KEYDOWN, this);
            document.addEventListener(TurtleChar.events.KEYUP, this);

          
        },

       
        stopListening: function () {
            document.removeEventListener(TurtleChar.events.KEYDOWN, this);
            document.removeEventListener(TurtleChar.events.KEYUP, this);

        },


        onPress: function (e) {


            if (TurtleChar.keycodes.UP[e.keyCode]) {
                this.playIntro();
                this.play = true;
                this.playing = true;
                this.RefreshDraw();
                this.play();
                return;
            }

            if (e.target != this.detailsButton) {
                if (!this.crashed && (TurtleChar.keycodes.JUMP[e.keyCode] ||
                    e.type == TurtleChar.events.TOUCHSTART)) {
                    if (!this.playing) {
                        this.loadSounds();
                        this.playing = true;
                        this.RefreshDraw();
                        if (window.errorPageController) {
                            errorPageController.trackEasterEgg();
                        }
                    }

                    if (!this.tRex.jumping && !this.tRex.ducking) {
                        this.playSound(this.soundFx.BUTTON_PRESS);
                        this.tRex.startJump(this.currentSpeed);
                    }
                }

                if (this.crashed && e.type == TurtleChar.events.TOUCHSTART &&
                    e.currentTarget == this.containerEl) {
                    this.restart();
                }
            }

            if (this.playing && !this.crashed && TurtleChar.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();
                if (this.tRex.jumping) {

                    this.tRex.setSpeedDrop();
                } else if (!this.tRex.jumping && !this.tRex.ducking) {

                    this.tRex.setDuck(true);
                    
                }

            }



        },



        outPress: function (e) {
            this.paused = false;
            this.play = false;

            var keyCode = String(e.keyCode);
            var isjumpKey = TurtleChar.keycodes.JUMP[keyCode] ||
                e.type == TurtleChar.events.TOUCHEND ||
                e.type == TurtleChar.events.MOUSEDOWN;

            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump();
            } else if (TurtleChar.keycodes.DUCK[keyCode]) {
                this.tRex.speedDrop = false;
                this.tRex.setDuck(false);
            } else if (this.crashed) {

                var deltaTime = getTimeStamp() - this.time;

                if (TurtleChar.keycodes.RESTART[keyCode] || this.isLeftClickOnCanvas(e) ||
                    (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
                        TurtleChar.keycodes.JUMP[keyCode])) {
                    this.restart();
                }
            } else if (this.paused && isjumpKey) {

                this.tRex.reset();
                this.play();
            }

            if (TurtleChar.keycodes.UP[e.keyCode]) {
                this.stop();
            }



        },


        isLeftClickOnCanvas: function (e) {
            return e.button != null && e.button < 2 &&
                e.type == TurtleChar.events.MOUSEUP && e.target == this.canvas;
        },


        scheduleNextRefreshDraw: function () {
            if (!this.RefreshDrawPending) {
                this.RefreshDrawPending = true;
                this.raqId = requestAnimationFrame(this.RefreshDraw.bind(this));
            }
        },


        isRunning: function () {
            return !!this.raqId;
        },


        gameOver: function () {
            this.playSound(this.soundFx.HIT);
            vibrate(200);

            this.stop();
            this.crashed = true;
            this.distanceMeter.acheivement = false;

            this.tRex.RefreshDraw(100, Trex.status.CRASHED);


            if (!this.gameOverPanel) {
                this.gameOverPanel = new GameOverPanel(this.canvas,
                    this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART,
                    this.dimensions);
            } else {
                this.gameOverPanel.draw();
            }


            if (this.distanceRan > this.highestScore) {
                this.highestScore = Math.ceil(this.distanceRan);
                this.distanceMeter.setHighScore(this.highestScore);
            }


            this.time = getTimeStamp();
        },

        stop: function () {
            this.playing = false;
            this.paused = true;
            cancelAnimationFrame(this.raqId);
            this.raqId = 0;
        },

        play: function () {
            if (!this.crashed) {
                this.playing = true;
                this.paused = false;
                this.tRex.RefreshDraw(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
                this.RefreshDraw();
            }
        },

        restart: function () {
            if (!this.raqId) {
                this.playCount++;
                this.runningTime = 0;
                this.playing = true;
                this.crashed = false;
                this.distanceRan = 0;
                this.setSpeed(this.config.SPEED);
                this.time = getTimeStamp();
                this.containerEl.classList.remove(TurtleChar.classes.CRASHED);
                this.clearCanvas();
                this.distanceMeter.reset(this.highestScore);
                this.horizon.reset();
                this.tRex.reset();
                this.playSound(this.soundFx.BUTTON_PRESS);
                this.invert(true);
                this.RefreshDraw();
            }
        },

        /**
        * Pause the game if the tab is not in focus.
        */
        onVisibilityChange: function (e) {
            if (document.hidden || document.webkitHidden || e.type == 'blur' ||
                document.visibilityState != 'visible') {
                this.stop();
            } else if (!this.crashed) {
                this.tRex.reset();
                this.play();
            }
        },

        /**
        * Play a sound.
        * @param {SoundBuffer} soundBuffer
        */
        playSound: function (soundBuffer) {
            if (soundBuffer) {
                var sourceNode = this.audioContext.createBufferSource();
                sourceNode.buffer = soundBuffer;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.start(0);
            }
        },

        /**
        * Inverts the current page / canvas colors.
        * @param {boolean} Whether to reset colors.
        */
        invert: function (reset) {
            if (reset) {
                document.body.classList.toggle(TurtleChar.classes.INVERTED, false);
                this.invertTimer = 0;
                this.inverted = false;
            } else {
                this.inverted = document.body.classList.toggle(TurtleChar.classes.INVERTED,
                    this.invertTrigger);
            }
        }
    };


    TurtleChar.RefreshDrawCanvasScaling = function (canvas, opt_width, opt_height) {
        var context = canvas.getContext('2d');


        var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        var ratio = devicePixelRatio / backingStoreRatio;

        // Upscale the canvas if the two ratios don't match
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = opt_width || canvas.width;
            var oldHeight = opt_height || canvas.height;

            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;

            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';


            context.scale(ratio, ratio);
            return true;
        } else if (devicePixelRatio == 1) {

            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
        }
        return false;
    };



    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }



    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }


    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ? TurtleChar.classes.CANVAS + ' ' +
            opt_classname : TurtleChar.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);

        return canvas;
    }



    function decodeBase64ToArrayBuffer(base64String) {
        var len = (base64String.length / 4) * 3;
        var str = atob(base64String);
        var arrayBuffer = new ArrayBuffer(len);
        var bytes = new Uint8Array(arrayBuffer);

        for (var i = 0; i < len; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return bytes.buffer;
    }



    function getTimeStamp() {
        return IS_IOS ? new Date().getTime() : performance.now();
    }



    function GameOverPanel(canvas, textImgPos, restartImgPos, dimensions) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.canvasDimensions = dimensions;
        this.textImgPos = textImgPos;
        this.restartImgPos = restartImgPos;
        this.draw();
    };



    GameOverPanel.dimensions = {
        TEXT_X: 0,
        TEXT_Y: 13,
        TEXT_WIDTH: 191,
        TEXT_HEIGHT: 11,
        RESTART_WIDTH: 36,
        RESTART_HEIGHT: 32
    };


    GameOverPanel.prototype = {

        RefreshDrawDimensions: function (width, opt_height) {
            this.canvasDimensions.WIDTH = width;
            if (opt_height) {
                this.canvasDimensions.HEIGHT = opt_height;
            }
        },


        draw: function () {
            var dimensions = GameOverPanel.dimensions;

            var centerX = this.canvasDimensions.WIDTH / 2;

            // Game over text.
            var textSourceX = dimensions.TEXT_X;
            var textSourceY = dimensions.TEXT_Y;
            var textSourceWidth = dimensions.TEXT_WIDTH;
            var textSourceHeight = dimensions.TEXT_HEIGHT;

            var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
            var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
            var textTargetWidth = dimensions.TEXT_WIDTH;
            var textTargetHeight = dimensions.TEXT_HEIGHT;

            var restartSourceWidth = dimensions.RESTART_WIDTH;
            var restartSourceHeight = dimensions.RESTART_HEIGHT;
            var restartTargetX = centerX - (dimensions.RESTART_WIDTH / 2);
            var restartTargetY = this.canvasDimensions.HEIGHT / 2;

            if (IS_HIDPI) {
                textSourceY *= 2;
                textSourceX *= 2;
                textSourceWidth *= 2;
                textSourceHeight *= 2;
                restartSourceWidth *= 2;
                restartSourceHeight *= 2;
            }

            textSourceX += this.textImgPos.x;
            textSourceY += this.textImgPos.y;

            // Game over text from sprite.
            this.canvasCtx.drawImage(TurtleChar.imageSprite,
                textSourceX, textSourceY, textSourceWidth, textSourceHeight,
                textTargetX, textTargetY, textTargetWidth, textTargetHeight);

            // Restart button.
            this.canvasCtx.drawImage(TurtleChar.imageSprite,
                this.restartImgPos.x, this.restartImgPos.y,
                restartSourceWidth, restartSourceHeight,
                restartTargetX, restartTargetY, dimensions.RESTART_WIDTH,
                dimensions.RESTART_HEIGHT);
        }
    };


    function checkForCollision(obstacle, tRex, opt_canvasCtx) {
        var obstacleBoxXPos = TurtleChar.defaultDimensions.WIDTH + obstacle.xPos;


        var tRexBox = new CollisionBox(
            tRex.xPos + 1,
            tRex.yPos + 1,
            tRex.config.WIDTH - 2,
            tRex.config.HEIGHT - 2);

        var obstacleBox = new CollisionBox(
            obstacle.xPos + 1,
            obstacle.yPos + 1,
            obstacle.typeConfig.width * obstacle.size - 2,
            obstacle.typeConfig.height - 2);


        if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
        }


        if (boxCompare(tRexBox, obstacleBox)) {
            var collisionBoxes = obstacle.collisionBoxes;
            var tRexCollisionBoxes = tRex.ducking ?
                Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING;


            for (var t = 0; t < tRexCollisionBoxes.length; t++) {
                for (var i = 0; i < collisionBoxes.length; i++) {

                    var adjTrexBox =
                        createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
                    var adjObstacleBox =
                        createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
                    var crashed = boxCompare(adjTrexBox, adjObstacleBox);


                    if (opt_canvasCtx) {
                        drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
                    }

                    if (crashed) {
                        return [adjTrexBox, adjObstacleBox];
                    }
                }
            }
        }
        return false;
    };



    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(
            box.x + adjustment.x,
            box.y + adjustment.y,
            box.width,
            box.height);
    };


    function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
        canvasCtx.save();
        canvasCtx.strokeStyle = '#f00';
        canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);

        canvasCtx.strokeStyle = '#0f0';
        canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y,
            obstacleBox.width, obstacleBox.height);
        canvasCtx.restore();
    };



    function boxCompare(tRexBox, obstacleBox) {
        var crashed = false;
        var tRexBoxX = tRexBox.x;
        var tRexBoxY = tRexBox.y;

        var obstacleBoxX = obstacleBox.x;
        var obstacleBoxY = obstacleBox.y;

        // Axis-Aligned Bounding Box method.
        if (tRexBox.x < obstacleBoxX + obstacleBox.width &&
            tRexBox.x + tRexBox.width > obstacleBoxX &&
            tRexBox.y < obstacleBox.y + obstacleBox.height &&
            tRexBox.height + tRexBox.y > obstacleBox.y) {
            crashed = true;
        }

        return crashed;
    };



    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    };



    function Obstacle(canvasCtx, type, spriteImgPos, dimensions,
        gapCoefficient, speed, opt_xOffset) {

        this.canvasCtx = canvasCtx;
        this.spritePos = spriteImgPos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = dimensions.WIDTH + (opt_xOffset || 0);
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;

        this.currentFrame = 0;
        this.timer = 0;

        this.init(speed);
    };


    Obstacle.MAX_GAP_COEFFICIENT = 1.5;


    Obstacle.MAX_OBSTACLE_LENGTH = 3,


        Obstacle.prototype = {

            init: function (speed) {
                this.cloneCollisionBoxes();

                if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
                    this.size = 1;
                }

                this.width = this.typeConfig.width * this.size;

                // Check if obstacle can be positioned at various heights.
                if (Array.isArray(this.typeConfig.yPos)) {
                    var yPosConfig = IS_MOBILE ? this.typeConfig.yPosMobile :
                        this.typeConfig.yPos;
                    this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)];
                } else {
                    this.yPos = this.typeConfig.yPos;
                }

                this.draw();


                if (this.size > 1) {
                    this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width -
                        this.collisionBoxes[2].width;
                    this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
                }

                if (this.typeConfig.speedOffset) {
                    this.speedOffset = Math.random() > 0.5 ? this.typeConfig.speedOffset :
                        -this.typeConfig.speedOffset;
                }

                this.gap = this.getGap(this.gapCoefficient, speed);
            },


            draw: function () {
                var sourceWidth = this.typeConfig.width;
                var sourceHeight = this.typeConfig.height;

                if (IS_HIDPI) {
                    sourceWidth = sourceWidth * 2;
                    sourceHeight = sourceHeight * 2;
                }


                var sourceX = (sourceWidth * this.size) * (0.5 * (this.size - 1)) +
                    this.spritePos.x;


                if (this.currentFrame > 0) {
                    sourceX += sourceWidth * this.currentFrame;
                }

                this.canvasCtx.drawImage(TurtleChar.imageSprite,
                    sourceX, this.spritePos.y,
                    sourceWidth * this.size, sourceHeight,
                    this.xPos, this.yPos,
                    this.typeConfig.width * this.size, this.typeConfig.height);
            },


            RefreshDraw: function (deltaTime, speed) {
                if (!this.remove) {
                    if (this.typeConfig.speedOffset) {
                        // speed += this.speedOffset;
                    }
                    this.xPos -= Math.floor((speed * FPS / 1000) * deltaTime);


                    if (this.typeConfig.numFrames) {
                        this.timer += deltaTime;
                        if (this.timer >= this.typeConfig.frameRate) {
                            this.currentFrame =
                                this.currentFrame == this.typeConfig.numFrames - 1 ?
                                    0 : this.currentFrame + 1;
                            this.timer = 0;
                        }
                    }
                    this.draw();

                    if (!this.isVisible()) {
                        this.remove = true;
                    }
                }
            },

            getGap: function (gapCoefficient, speed) {
                var minGap = Math.round(this.width * speed +
                    this.typeConfig.minGap * gapCoefficient);
                var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
                return getRandomNum(minGap, maxGap);
            },


            isVisible: function () {
                return this.xPos + this.width > 0;
            },


            cloneCollisionBoxes: function () {
                var collisionBoxes = this.typeConfig.collisionBoxes;

                for (var i = collisionBoxes.length - 1; i >= 0; i--) {
                    this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x,
                        collisionBoxes[i].y, collisionBoxes[i].width,
                        collisionBoxes[i].height);
                }
            }
        };



    Obstacle.types = [
        {
            type: 'CACTUS_SMALL',
            width: 17,
            height: 35,
            yPos: 105,
            multipleSpeed: 4,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 7, 5, 27),
                new CollisionBox(4, 0, 6, 34),
                new CollisionBox(10, 4, 7, 14)
            ]
        },
        {
            type: 'CACTUS_LARGE',
            width: 25,
            height: 50,
            yPos: 90,
            multipleSpeed: 7,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 12, 7, 38),
                new CollisionBox(8, 0, 7, 49),
                new CollisionBox(13, 10, 10, 38)
            ]
        },
        {
            type: 'PTERODACTYL',
            width: 46,
            height: 40,
            yPos: [100, 75, 50],
            yPosMobile: [100, 50],
            multipleSpeed: 999,
            minSpeed: 8.5,
            minGap: 150,
            collisionBoxes: [
                new CollisionBox(15, 15, 16, 5),
                new CollisionBox(18, 21, 24, 6),
                new CollisionBox(2, 14, 4, 3),
                new CollisionBox(6, 10, 4, 7),
                new CollisionBox(10, 8, 6, 9)
            ],
            numFrames: 2,
            frameRate: 1000 / 6,
            speedOffset: .8
        }
    ];



    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.blinkDelay = 0;
        this.blinkCount = 0;
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;

        this.status = Trex.status.WAITING;

        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;

        this.init();
    };


    /**
    * T-rex player config.
    * @enum {number}
    */
    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
        HEIGHT: 47,
        HEIGHT_DUCK: 25,
        INIITAL_JUMP_VELOCITY: -10,
        INTRO_DURATION: 1500,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        SPRITE_WIDTH: 262,
        START_X_POS: 50,
        WIDTH: 44,
        WIDTH_DUCK: 59
    };


    /**
    * Used in collision detection.
    * @type {Array<CollisionBox>}
    */
    Trex.collisionBoxes = {
        DUCKING: [
            new CollisionBox(1, 18, 55, 25)
        ],
        RUNNING: [
            new CollisionBox(22, 0, 17, 16),
            new CollisionBox(1, 18, 30, 9),
            new CollisionBox(10, 35, 14, 8),
            new CollisionBox(1, 24, 29, 5),
            new CollisionBox(5, 30, 21, 4),
            new CollisionBox(9, 34, 15, 4)
        ]
    };


    Trex.status = {
        CRASHED: 'CRASHED',
        DUCKING: 'DUCKING',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING'
    };

    Trex.BLINK_TIMING = 7000;



    Trex.animFrames = {
        WAITING: {
            frames: [44, 0],
            msPerFrame: 1000 / 3
        },
        RUNNING: {
            frames: [88, 132],
            msPerFrame: 1000 / 12
        },
        CRASHED: {
            frames: [220],
            msPerFrame: 1000 / 60
        },
        JUMPING: {
            frames: [0],
            msPerFrame: 1000 / 60
        },
        DUCKING: {
            frames: [264, 323],
            msPerFrame: 1000 / 8
        }
    };


    Trex.prototype = {

        init: function () {
            this.groundYPos = TurtleChar.defaultDimensions.HEIGHT - this.config.HEIGHT -
                TurtleChar.config.BOTTOM_PAD;
            this.yPos = this.groundYPos;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;

            this.draw(0, 0);
            this.RefreshDraw(0, Trex.status.WAITING);
        },


        setJumpVelocity: function (setting) {
            this.config.INIITAL_JUMP_VELOCITY = -setting;
            this.config.DROP_VELOCITY = -setting / 2;
        },

        RefreshDraw: function (deltaTime, opt_status) {
            this.timer += deltaTime;


            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;

                if (opt_status == Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                    this.setBlinkDelay();
                }
            }


            if (this.playingIntro && this.xPos < this.config.START_X_POS) {
                this.xPos += Math.round((this.config.START_X_POS /
                    this.config.INTRO_DURATION) * deltaTime);
            }

            if (this.status == Trex.status.WAITING) {
                this.blink(getTimeStamp());
            } else {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
            }


            if (this.timer >= this.msPerFrame) {
                this.currentFrame = this.currentFrame ==
                    this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
                this.timer = 0;
            }


            if (this.speedDrop && this.yPos == this.groundYPos) {
                this.speedDrop = false;
                this.setDuck(true);
            }
        },


        draw: function (x, y) {
            var sourceX = x;
            var sourceY = y;
            var sourceWidth = this.ducking && this.status != Trex.status.CRASHED ?
                this.config.WIDTH_DUCK : this.config.WIDTH;
            var sourceHeight = this.config.HEIGHT;

            if (IS_HIDPI) {
                sourceX *= 2;
                sourceY *= 2;
                sourceWidth *= 2;
                sourceHeight *= 2;
            }


            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            if (this.ducking && this.status != Trex.status.CRASHED) {
                this.canvasCtx.drawImage(TurtleChar.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH_DUCK, this.config.HEIGHT);
            } else {

                if (this.ducking && this.status == Trex.status.CRASHED) {
                    this.xPos++;
                }

                this.canvasCtx.drawImage(TurtleChar.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH, this.config.HEIGHT);
            }
        },

        setBlinkDelay: function () {
            this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
        },


        blink: function (time) {
            var deltaTime = time - this.animStartTime;

            if (deltaTime >= this.blinkDelay) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);

                if (this.currentFrame == 1) {

                    this.setBlinkDelay();
                    this.animStartTime = time;
                    this.blinkCount++;
                }
            }
        },


        startJump: function (speed) {
            if (!this.jumping) {
                this.RefreshDraw(0, Trex.status.JUMPING);

                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - (speed / 10);
                this.jumping = true;
                this.reachedMinHeight = false;
                this.speedDrop = false;
            }
        },


        endJump: function () {
            if (this.reachedMinHeight &&
                this.jumpVelocity < this.config.DROP_VELOCITY) {
                this.jumpVelocity = this.config.DROP_VELOCITY;
            }
        },


        RefreshDrawJump: function (deltaTime, speed) {
            var msPerFrame = Trex.animFrames[this.status].msPerFrame;
            var framesElapsed = deltaTime / msPerFrame;


            if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity *
                    this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            }

            this.jumpVelocity += this.config.GRAVITY * framesElapsed;


            if (this.yPos < this.minJumpHeight || this.speedDrop) {
                this.reachedMinHeight = true;
            }

            if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
                this.endJump();
            }

            // Back down at ground level. Jump completed.
            if (this.yPos > this.groundYPos) {
                this.reset();
                this.jumpCount++;
            }

            this.RefreshDraw(deltaTime);
        },


        setSpeedDrop: function () {
            this.speedDrop = true;
            this.jumpVelocity = 1;
        },


        setDuck: function (isDucking) {
            if (isDucking && this.status != Trex.status.DUCKING) {
                this.RefreshDraw(0, Trex.status.DUCKING);
                this.ducking = true;
            } else if (this.status == Trex.status.DUCKING) {
                this.RefreshDraw(0, Trex.status.RUNNING);
                this.ducking = false;
            }
        },


        reset: function () {
            this.yPos = this.groundYPos;
            this.jumpVelocity = 0;
            this.jumping = false;
            this.ducking = false;
            this.RefreshDraw(0, Trex.status.RUNNING);
            this.midair = false;
            this.speedDrop = false;
            this.jumpCount = 0;
        }
    };


    //******************************************************************************


    function Dist(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.image = TurtleChar.imageSprite;
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 5;

        this.currentDistance = 0;
        this.maxScore = 0;
        this.highScore = 0;
        this.container = null;

        this.digits = [];
        this.acheivement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;
        this.invertTrigger = false;

        this.config = Dist.config;
        this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
        this.init(canvasWidth);
    };



    Dist.dimensions = {
        WIDTH: 10,
        HEIGHT: 13,
        DEST_WIDTH: 11
    };



    Dist.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];


    Dist.config = {

        MAX_DISTANCE_UNITS: 5,


        ACHIEVEMENT_DISTANCE: 100,


        COEFFICIENT: 0.025,


        FLASH_DURATION: 1000 / 4,


        FLASH_ITERATIONS: 3
    };


    Dist.prototype = {

        init: function (width) {
            var maxDistanceStr = '';

            this.calcXPos(width);
            this.maxScore = this.maxScoreUnits;
            for (var i = 0; i < this.maxScoreUnits; i++) {
                this.draw(i, 0);
                this.defaultString += '0';
                maxDistanceStr += '9';
            }

            this.maxScore = parseInt(maxDistanceStr);
        },

        calcXPos: function (canvasWidth) {
            this.x = canvasWidth - (Dist.dimensions.DEST_WIDTH *
                (this.maxScoreUnits + 1));
        },


        draw: function (digitPos, value, opt_highScore) {
            var sourceWidth = Dist.dimensions.WIDTH;
            var sourceHeight = Dist.dimensions.HEIGHT;
            var sourceX = Dist.dimensions.WIDTH * value;
            var sourceY = 0;

            var targetX = digitPos * Dist.dimensions.DEST_WIDTH;
            var targetY = this.y;
            var targetWidth = Dist.dimensions.WIDTH;
            var targetHeight = Dist.dimensions.HEIGHT;


            if (IS_HIDPI) {
                sourceWidth *= 2;
                sourceHeight *= 2;
                sourceX *= 2;
            }

            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            this.canvasCtx.save();

            if (opt_highScore) {

                var highScoreX = this.x - (this.maxScoreUnits * 2) *
                    Dist.dimensions.WIDTH;
                this.canvasCtx.translate(highScoreX, this.y);
            } else {
                this.canvasCtx.translate(this.x, this.y);
            }

            this.canvasCtx.drawImage(this.image, sourceX, sourceY,
                sourceWidth, sourceHeight,
                targetX, targetY,
                targetWidth, targetHeight
            );

            this.canvasCtx.restore();
        },


        getActualDistance: function (distance) {
            return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
        },


        RefreshDraw: function (deltaTime, distance) {
            var paint = true;
            var playSound = false;

            if (!this.acheivement) {
                distance = this.getActualDistance(distance);

                if (distance > this.maxScore && this.maxScoreUnits ==
                    this.config.MAX_DISTANCE_UNITS) {
                    this.maxScoreUnits++;
                    this.maxScore = parseInt(this.maxScore + '9');
                } else {
                    this.distance = 0;
                }

                if (distance > 0) {

                    if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {

                        this.acheivement = true;
                        this.flashTimer = 0;
                        playSound = true;
                    }


                    var distanceStr = (this.defaultString +
                        distance).substr(-this.maxScoreUnits);
                    this.digits = distanceStr.split('');
                } else {
                    this.digits = this.defaultString.split('');
                }
            } else {

                if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                    this.flashTimer += deltaTime;

                    if (this.flashTimer < this.config.FLASH_DURATION) {
                        paint = false;
                    } else if (this.flashTimer >
                        this.config.FLASH_DURATION * 2) {
                        this.flashTimer = 0;
                        this.flashIterations++;
                    }
                } else {
                    this.acheivement = false;
                    this.flashIterations = 0;
                    this.flashTimer = 0;
                }
            }




            return playSound;
        },




        reset: function () {
            this.RefreshDraw(0);
            this.acheivement = false;
        }
    };



    function Tree(canvas, spritePos, containerWidth) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.containerWidth = containerWidth;
        this.xPos = containerWidth;
        this.yPos = 0;
        this.remove = false;
        this.TreeGap = getRandomNum(Tree.config.MIN_Tree_GAP,
            Tree.config.MAX_Tree_GAP);

        this.init();
    };



    Tree.config = {
        HEIGHT: 14,
        MAX_Tree_GAP: 400,
        MAX_SKY_LEVEL: 30,
        MIN_Tree_GAP: 100,
        MIN_SKY_LEVEL: 71,
        WIDTH: 46
    };


    Tree.prototype = {

        init: function () {
            this.yPos = getRandomNum(Tree.config.MAX_SKY_LEVEL,
                Tree.config.MIN_SKY_LEVEL);
            this.draw();
        },


        draw: function () {
            this.canvasCtx.save();
            var sourceWidth = Tree.config.WIDTH;
            var sourceHeight = Tree.config.HEIGHT;

            if (IS_HIDPI) {
                sourceWidth = sourceWidth * 2;
                sourceHeight = sourceHeight * 2;
            }

            this.canvasCtx.drawImage(TurtleChar.imageSprite, this.spritePos.x,
                this.spritePos.y,
                sourceWidth, sourceHeight,
                this.xPos, this.yPos,
                Tree.config.WIDTH, Tree.config.HEIGHT);

            this.canvasCtx.restore();
        },


        RefreshDraw: function (speed) {
            if (!this.remove) {
                this.xPos -= Math.ceil(speed);
                this.draw();

                // Mark as removeable if no longer in the canvas.
                if (!this.isVisible()) {
                    this.remove = true;
                }
            }
        },


        isVisible: function () {
            return this.xPos + Tree.config.WIDTH > 0;
        }
    };



    


    function HorizonLine(canvas, spritePos) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.sourceXPos = [this.spritePos.x, this.spritePos.x +
            this.dimensions.WIDTH];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;

        this.setSourceDimensions();
        this.draw();
    };



    HorizonLine.dimensions = {
        WIDTH: 600,
        HEIGHT: 12,
        YPOS: 127
    };


    HorizonLine.prototype = {

        setSourceDimensions: function () {

            for (var dimension in HorizonLine.dimensions) {
                if (IS_HIDPI) {
                    if (dimension != 'YPOS') {
                        this.sourceDimensions[dimension] =
                            HorizonLine.dimensions[dimension] * 2;
                    }
                } else {
                    this.sourceDimensions[dimension] =
                        HorizonLine.dimensions[dimension];
                }
                this.dimensions[dimension] = HorizonLine.dimensions[dimension];
            }

            this.xPos = [0, HorizonLine.dimensions.WIDTH];
            this.yPos = HorizonLine.dimensions.YPOS;
        },


        getRandomType: function () {
            return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
        },


        draw: function () {
            this.canvasCtx.drawImage(TurtleChar.imageSprite, this.sourceXPos[0],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[0], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);

            this.canvasCtx.drawImage(TurtleChar.imageSprite, this.sourceXPos[1],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[1], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },


        RefreshDrawXPos: function (pos, increment) {
            var line1 = pos;
            var line2 = pos == 0 ? 1 : 0;

            this.xPos[line1] -= increment;
            this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;

            if (this.xPos[line1] <= -this.dimensions.WIDTH) {
                this.xPos[line1] += this.dimensions.WIDTH * 2;
                this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
                this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
            }
        },


        RefreshDraw: function (deltaTime, speed) {
            var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

            if (this.xPos[0] <= 0) {
                this.RefreshDrawXPos(0, increment);
            } else {
                this.RefreshDrawXPos(1, increment);
            }
            this.draw();
        },


        reset: function () {
            this.xPos[0] = 0;
            this.xPos[1] = HorizonLine.dimensions.WIDTH;
        }
    };


    function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonOffsets = [0, 0];
        this.TreeFrequency = this.config.Tree_FREQUENCY;
        this.spritePos = spritePos;
      
        // Tree
        this.Trees = [];
        this.TreeSpeed = this.config.BG_Tree_SPEED;

        // Horizon
        this.horizonLine = null;
        this.init();
    };


  
    Horizon.config = {
        BG_Tree_SPEED: 0.2,
        BUMPY_THRESHOLD: .3,
        Tree_FREQUENCY: .1,
        HORIZON_HEIGHT: 16,
        MAX_TreeS: 6
    };


    Horizon.prototype = {

        init: function () {
            this.addTree();
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
          
        },


        RefreshDraw: function (deltaTime, currentSpeed, RefreshDrawObstacles, showNightMode) {
            this.runningTime += deltaTime;
            this.horizonLine.RefreshDraw(deltaTime, currentSpeed);
          
            this.RefreshDrawTrees(deltaTime, currentSpeed);

            if (RefreshDrawObstacles) {
                this.RefreshDrawObstacles(deltaTime, currentSpeed);
            }
        },


        RefreshDrawTrees: function (deltaTime, speed) {
            var TreeSpeed = this.TreeSpeed / 1000 * deltaTime * speed;
            var numTrees = this.Trees.length;

            if (numTrees) {
                for (var i = numTrees - 1; i >= 0; i--) {
                    this.Trees[i].RefreshDraw(TreeSpeed);
                }

                var lastTree = this.Trees[numTrees - 1];


                if (numTrees < this.config.MAX_TreeS &&
                    (this.dimensions.WIDTH - lastTree.xPos) > lastTree.TreeGap &&
                    this.TreeFrequency > Math.random()) {
                    this.addTree();
                }


                this.Trees = this.Trees.filter(function (obj) {
                    return !obj.remove;
                });
            } else {
                this.addTree();
            }
        },


        RefreshDrawObstacles: function (deltaTime, currentSpeed) {

            var RefreshDrawdObstacles = this.obstacles.slice(0);

            for (var i = 0; i < this.obstacles.length; i++) {
                var obstacle = this.obstacles[i];
                obstacle.RefreshDraw(deltaTime, currentSpeed);


                if (obstacle.remove) {
                    RefreshDrawdObstacles.shift();
                }
            }
            this.obstacles = RefreshDrawdObstacles;

            if (this.obstacles.length > 0) {
                var lastObstacle = this.obstacles[this.obstacles.length - 1];

                if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                    lastObstacle.isVisible() &&
                    (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) <
                    this.dimensions.WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {

                this.addNewObstacle(currentSpeed);
            }
        },

        removeFirstObstacle: function () {
            this.obstacles.shift();
        },


        addNewObstacle: function (currentSpeed) {
            var obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
            var obstacleType = Obstacle.types[obstacleTypeIndex];


            if (this.duplicateObstacleCheck(obstacleType.type) ||
                currentSpeed < obstacleType.minSpeed) {
                this.addNewObstacle(currentSpeed);
            } else {
                var obstacleSpritePos = this.spritePos[obstacleType.type];

                this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType,
                    obstacleSpritePos, this.dimensions,
                    this.gapCoefficient, currentSpeed, obstacleType.width));

                this.obstacleHistory.unshift(obstacleType.type);

                if (this.obstacleHistory.length > 1) {
                    this.obstacleHistory.splice(TurtleChar.config.MAX_OBSTACLE_DUPLICATION);
                }
            }
        },


        duplicateObstacleCheck: function (nextObstacleType) {
            var duplicateCount = 0;

            for (var i = 0; i < this.obstacleHistory.length; i++) {
                duplicateCount = this.obstacleHistory[i] == nextObstacleType ?
                    duplicateCount + 1 : 0;
            }
            return duplicateCount >= TurtleChar.config.MAX_OBSTACLE_DUPLICATION;
        },


        reset: function () {
            this.obstacles = [];
            this.horizonLine.reset();
          
        },


        resize: function (width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
        },


        addTree: function () {
            this.Trees.push(new Tree(this.canvas, this.spritePos.Tree,
                this.dimensions.WIDTH));
        }
    };
})();


function onDocumentLoad() {
    new TurtleChar('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
