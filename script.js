       const config = {
        SPEED: 10,
        ACCELERATION: 0.001,
        COEFFICIENT: 0.025,
        TARGET_FPS: 60,
        MS_PER_FRAME: 1000 / 60
    };

    class DistanceMeter {
        constructor() {
            this.distanceRan = 0;
            this.displayScore = 0;
            this.maxScore = parseInt(localStorage.getItem('satoshiRunnerMaxScore')) || 0;
        }

        update(currentSpeed, deltaTime) {
            this.distanceRan += currentSpeed * deltaTime / config.MS_PER_FRAME;
            this.displayScore = Math.round(this.distanceRan * config.COEFFICIENT);
        }

        getScore() {
            return this.displayScore;
        }

        getDistance() {
            return Math.round(this.distanceRan);
        }

        updateHighScore() {
            if (this.displayScore > this.maxScore) {
                this.maxScore = this.displayScore;
                localStorage.setItem('satoshiRunnerMaxScore', this.maxScore.toString());
                return true;
            }
            return false;
        }

        reset() {
            this.distanceRan = 0;
            this.displayScore = 0;
        }
    }

    class Horizon {
        constructor(gameWidth, groundY) {
            this.gameWidth = gameWidth;
            this.groundY = groundY;
            this.obstacles = [];
            this.lastObstacleX = gameWidth;
            this.minGap = 200;
            this.maxGap = 400;
            this.obstacleTypes = ['obstacle1', 'obstacle2', 'obstacle3', 'obstacle4', 'obstacle5', 'obstacle6'];
            this.spawnTimer = 0;
            this.nextSpawnInterval = 0;
        }

        updateObstacles(currentSpeed, deltaTime) {
            for (let i = this.obstacles.length - 1; i >= 0; i--) {
                this.obstacles[i].x -= currentSpeed * deltaTime / config.MS_PER_FRAME;
                if (this.obstacles[i].x + this.obstacles[i].width < 0) {
                    this.obstacles.splice(i, 1);
                }
            }

            if (this.nextSpawnInterval === 0) {
                const rawInterval = Math.random() * 2000 + 10000;
                this.nextSpawnInterval = Math.max(1800, rawInterval / currentSpeed);
            }
            this.spawnTimer += deltaTime;

            if (this.obstacles.length === 0 || this.spawnTimer >= this.nextSpawnInterval) {
                this.addNewObstacle();
                this.spawnTimer = 0;
                this.nextSpawnInterval = 0;
            }
        }

        addNewObstacle() {
            const obstacleType = this.obstacleTypes[Math.floor(Math.random() * this.obstacleTypes.length)];
            const scale = Math.min(this.gameWidth / 1200, 1.0);
            const baseSize = 50 * Math.max(scale, 0.7);
            const obstacle = {
                x: this.gameWidth + 50,
                y: this.groundY,
                width: baseSize,
                height: baseSize * 1.2,
                type: obstacleType
            };
            if (obstacleType === 'obstacle4') {
                obstacle.height = baseSize * 1;
                obstacle.y = this.groundY - baseSize + 60;
            }
            else if (obstacleType === 'obstacle6') {
                obstacle.y = this.groundY - obstacle.height + 30;
            }
            else if (
                obstacleType === 'obstacle1' ||
                obstacleType === 'obstacle2' ||
                obstacleType === 'obstacle3' ||
                obstacleType === 'obstacle5'
            ) {
                obstacle.y = this.groundY - obstacle.height + 60;
            } else {
                obstacle.y = this.groundY - obstacle.height;
            }
            this.obstacles.push(obstacle);
        }

        getObstacles() {
            return this.obstacles;
        }

        reset() {
            this.obstacles = [];
            this.lastObstacleX = this.gameWidth;
            this.spawnTimer = 0;
            this.nextSpawnInterval = 0;
        }
    }

    class SatoshiRunner {
        constructor() {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d');
            
            this.animationFrameId = null;
            this.isLoopRunning = false;
            
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            
            this.groundY = this.gameHeight - 80;
            
            this.gameRunning = false;
            this.gameOver = false;
            this.lastTime = 0;
            this.deltaTime = 0;
            this.fps = 0;
            this.fpsCounter = 0;
            this.fpsTime = 0;
            
            this.currentSpeed = config.SPEED;
            this.maxSpeedReached = config.SPEED;
            
            this.distanceMeter = new DistanceMeter();
            
            this.initPlayer();
            
            this.gravity = 1.0;
            this.jumpPower = -18;
            
            this.bgX = 0;
            
            this.horizon = new Horizon(this.gameWidth, this.groundY);
            
            this.images = {};
            this.imagesLoaded = 0;
            this.totalImages = 9;
            
            this.eventsBound = false;
            
            this.loadImages();
            this.bindEvents();
            this.updateUI();
        }

        initPlayer() {
            this.player = {
                x: 150,
                y: this.groundY,
                width: 50,
                height: 60,
                velocityY: 0,
                onGround: true,
                state: 'run',
                crouching: false,
                fastDropping: false
            };
        }
        
        resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';

            this.gameWidth = this.canvas.width;
            this.gameHeight = this.canvas.height;
            this.groundY = this.gameHeight - 80;
            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // リセット（念のため残す）

            if (this.player) {
                this.player.y = this.groundY;
            }

            if (this.horizon) {
                this.horizon.gameWidth = this.gameWidth;
                this.horizon.groundY = this.groundY;
            }
        }
        
        loadImages() {
            const imageList = [
                { key: 'bg', src: 'assets/bg.png' },
                { key: 'run', src: 'assets/run.png' },
                { key: 'jump', src: 'assets/jump.png' },
                { key: 'death', src: 'assets/death.png' },
                { key: 'obstacle1', src: 'assets/obstacles1.png' },
                { key: 'obstacle2', src: 'assets/obstacles2.png' },
                { key: 'obstacle3', src: 'assets/obstacles3.png' },
                { key: 'obstacle4', src: 'assets/obstacles4.png' },
                { key: 'obstacle5', src: 'assets/obstacles5.png' },
                { key: 'obstacle6', src: 'assets/obstacles6.png' },
                { key: 'shift', src: 'assets/shift.png' }
            ];
            this.totalImages = imageList.length;
            imageList.forEach(img => {
                this.images[img.key] = new Image();
                this.images[img.key].onload = () => {
                    this.imagesLoaded++;
                    if (this.imagesLoaded === this.totalImages) {
                        this.startGame();
                    }
                };
                this.images[img.key].onerror = () => {
                    console.log(`画像の読み込みに失敗: ${img.src}`);
                    this.imagesLoaded++;
                    if (this.imagesLoaded === this.totalImages) {
                        this.startGame();
                    }
                };
                this.images[img.key].src = img.src;
            });
        }
        
        bindEvents() {
            if (this.eventsBound) return;

            this.keydownHandler = (e) => {
                if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    this.handleSpaceKey();
                } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    e.preventDefault();
                    this.startCrouch();
                }
            };

            this.keyupHandler = (e) => {
                if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    e.preventDefault();
                    this.endCrouch();
                }
            };

            this.touchHandler = (e) => {
                e.preventDefault();
                this.handleSpaceKey();
            };

            this.clickHandler = (e) => {
                e.preventDefault();
                this.handleSpaceKey();
            };

            document.addEventListener('keydown', this.keydownHandler);
            document.addEventListener('keyup', this.keyupHandler);
            this.canvas.addEventListener('touchstart', this.touchHandler);
            this.canvas.addEventListener('click', this.clickHandler);

            this.eventsBound = true;
        }

        handleSpaceKey() {
            if (this.inputDisabledUntil && performance.now() < this.inputDisabledUntil) {
                return;
            }
            if (this.gameOver) {
                this.restart();
            } else if (this.gameRunning && this.player.onGround) {
                this.jump();
            }
        }

        stopGameLoop() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this.isLoopRunning = false;
        }
        
        startGame() {
            console.log('ゲーム開始');
            if (!this.isLoopRunning) {
                this.gameRunning = true;
                this.lastTime = performance.now();
                this.fpsTime = this.lastTime;
                this.isLoopRunning = true;
                this.gameLoop(this.lastTime);
            }

            const instructions = document.getElementById('instructions');
            if (instructions) {
                instructions.style.opacity = '1'; 
                instructions.classList.remove('hidden');
                setTimeout(() => {
                    instructions.classList.add('hidden'); 
                }, 3000);
            }
            this.uiUpdateInterval = setInterval(() => this.updateUI(), 1000);
        }
        
        jump() {
            if (this.player.onGround) {
                this.player.velocityY = this.jumpPower;
                this.player.onGround = false;
                this.player.state = 'jump';
            }
        }

        updateSpeed() {
            this.currentSpeed += config.ACCELERATION;


            if (this.currentSpeed > this.maxSpeedReached) {
                this.maxSpeedReached = this.currentSpeed;
            }
        }
        
        updatePlayer() {

            if (!this.player.onGround) {
                this.player.velocityY += this.gravity;
                this.player.y += this.player.velocityY;


                const groundLevel = this.groundY + 60;
                if (this.player.y + this.player.height >= groundLevel) {
                    this.player.y = groundLevel - this.player.height;
                    this.player.velocityY = 0;
                    this.player.onGround = true;
                    if (this.player.crouching) {
                        this.endCrouch();
                    } else if (this.player.state === 'jump') {
                        this.player.state = 'run';
                    }
                }
            }
        }
        
        checkCollisions() {
            const playerHitbox = {
                x: this.player.x + this.player.width * 0.1,
                y: this.player.y + this.player.height * 0.1,
                width: this.player.width * 0.8,
                height: this.player.height * 0.8
            };
            
            const obstacles = this.horizon.getObstacles();
            for (let obstacle of obstacles) {
                const obstacleHitbox = {
                    x: obstacle.x + obstacle.width * 0.1,
                    y: obstacle.y + obstacle.height * 0.1,
                    width: obstacle.width * 0.8,
                    height: obstacle.height * 0.8
                };
                
                if (playerHitbox.x < obstacleHitbox.x + obstacleHitbox.width &&
                    playerHitbox.x + playerHitbox.width > obstacleHitbox.x &&
                    playerHitbox.y < obstacleHitbox.y + obstacleHitbox.height &&
                    playerHitbox.y + playerHitbox.height > obstacleHitbox.y) {
                    this.gameOverHandler();
                    return;
                }
            }
        }
        
        gameOverHandler() {
            console.log('ゲームオーバー');
            this.gameRunning = false;
            this.gameOver = true;
            this.player.state = 'death';
            this.distanceMeter.updateHighScore();
            
            this.showGameOverScreen();
            this.inputDisabledUntil = performance.now() + 2000;
        }
        
        showGameOverScreen() {
            document.getElementById('finalScore').textContent = this.distanceMeter.getScore();
            document.getElementById('finalHighScore').textContent = this.distanceMeter.maxScore;
            document.getElementById('finalDistance').textContent = this.distanceMeter.getDistance();
            document.getElementById('finalMaxSpeed').textContent = this.maxSpeedReached.toFixed(1);
            document.getElementById('gameOverScreen').style.display = 'block';
        }
        restart() {
            console.log('リスタート開始');
            this.gameOver = false;
            this.gameRunning = true;
            
            this.currentSpeed = config.SPEED;
            this.maxSpeedReached = config.SPEED;
            
            this.initPlayer();
            
            this.bgX = 0;
            
            this.lastTime = 0;
            this.deltaTime = 0;
            this.fps = 0;
            this.fpsCounter = 0;
            this.fpsTime = 0;
            
            this.distanceMeter.reset();
            this.horizon.reset();
            
            document.getElementById('gameOverScreen').style.display = 'none';
            this.updateUI();

            this.uiUpdateInterval = setInterval(() => this.updateUI(), 1000);
            
            console.log('リスタート完了');
        }
        
        updateUI() {
            document.getElementById('score').textContent = this.distanceMeter.getScore();
            document.getElementById('highScore').textContent = this.distanceMeter.maxScore;
            document.getElementById('distance').textContent = this.distanceMeter.getDistance();
            document.getElementById('currentSpeed').textContent = this.currentSpeed.toFixed(1);
            document.getElementById('maxSpeed').textContent = '∞';
            document.getElementById('fps').textContent = Math.round(this.fps);
        }

        calculateFPS(currentTime) {
            this.fpsCounter++;
            if (currentTime >= this.fpsTime + 1000) {
                this.fps = this.fpsCounter;
                this.fpsCounter = 0;
                this.fpsTime = currentTime;
            }
        }
        
        drawBackground() {
            if (this.images.bg && this.images.bg.complete) {
                const bgWidth = this.images.bg.width;
                const bgHeight = this.images.bg.height;
                
                const scale = Math.max(this.gameHeight / bgHeight, this.gameWidth / bgWidth);
                const scaledWidth = bgWidth * scale;
                const scaledHeight = bgHeight * scale;
                
                this.bgX -= (this.currentSpeed * this.deltaTime / config.MS_PER_FRAME) * 0.3;
                if (this.bgX <= -scaledWidth) {
                    this.bgX = 0;
                }
                
                const y = (this.gameHeight - scaledHeight) / 2;
                this.ctx.drawImage(this.images.bg, this.bgX, y, scaledWidth, scaledHeight);
                this.ctx.drawImage(this.images.bg, this.bgX + scaledWidth, y, scaledWidth, scaledHeight);
            } else {
                const gradient = this.ctx.createLinearGradient(0, 0, 0, this.gameHeight);
                gradient.addColorStop(0, '#87CEEB');
                gradient.addColorStop(1, '#98FB98');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
            }
        }
        
        drawGround() {
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(0, this.groundY + 60, this.gameWidth, 80);
            
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(0, this.groundY + 60, this.gameWidth, 5);
        }
        
        drawPlayer() {
            let playerImage;
            if (this.player.state === 'shift') {
                playerImage = this.images['shift'];
            } else {
                playerImage = this.images[this.player.state];
            }
            if (playerImage && playerImage.complete) {
                this.ctx.drawImage(
                    playerImage,
                    this.player.x,
                    this.player.y,
                    this.player.width,
                    this.player.height
                );
            } else {
                this.ctx.fillStyle = this.player.state === 'death' ? '#FF0000' : '#0066CC';
                this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
            }
        }
        startCrouch() {
            if (this.player.onGround && !this.player.crouching) {
                console.log("しゃがみ開始");
                this.player.crouching = true;
                this.player.state = 'shift';
                const originalHeight = this.player.height;
                this.player.height = originalHeight / 2;
                this.player.y = this.groundY + (originalHeight - this.player.height);
            } else if (!this.player.onGround && !this.player.fastDropping) {
                console.log("空中で下押し → 高速落下");
                this.player.velocityY += 5;
                this.player.fastDropping = true;
            }
        }

        endCrouch() {
            if (this.player.crouching) {
                console.log("しゃがみ解除");
                this.player.height *= 2;
                this.player.y = this.groundY;
                this.player.crouching = false;
                this.player.state = 'run';
            }
            this.player.fastDropping = false;
        }
        
        drawObstacles() {
            const obstacles = this.horizon.getObstacles();
            for (let obstacle of obstacles) {
                const obstacleImage = this.images[obstacle.type];
                if (obstacleImage && obstacleImage.complete) {
                    this.ctx.drawImage(
                        obstacleImage,
                        obstacle.x,
                        obstacle.y,
                        obstacle.width,
                        obstacle.height
                    );
                } else {
                    this.ctx.fillStyle = '#FF4444';
                    this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                }
            }
        }
        
        
        render() {
            this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
            
            this.drawBackground();
            this.drawGround();
            this.drawPlayer();
            this.drawObstacles();
            
            if (this.imagesLoaded < this.totalImages) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '24px Courier New';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`Loading... ${this.imagesLoaded}/${this.totalImages}`, this.gameWidth / 2, this.gameHeight / 2);
                this.ctx.textAlign = 'left';
            }
        }
        
        gameLoop(currentTime) {
            this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
            
            if (this.lastTime === 0) {
                this.lastTime = currentTime;
                this.fpsTime = currentTime;
                return;
            }
            
            this.deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            this.calculateFPS(currentTime);
            
            if (this.gameRunning && !this.gameOver) {
                this.updateSpeed();
                
                this.updatePlayer();
                
                this.horizon.updateObstacles(this.currentSpeed, this.deltaTime);
                
                this.checkCollisions();
                
                this.distanceMeter.update(this.currentSpeed, this.deltaTime);
                // this.updateUI();  // UI更新はsetIntervalで行う
            }
            
            this.render();
        }

        destroy() {
            this.stopGameLoop();

            if (this.eventsBound) {
                document.removeEventListener('keydown', this.keydownHandler);
                document.removeEventListener('keyup', this.keyupHandler);
                this.canvas.removeEventListener('touchstart', this.touchHandler);
                this.canvas.removeEventListener('click', this.clickHandler);
                this.eventsBound = false;
            }
            if (this.uiUpdateInterval) {
                clearInterval(this.uiUpdateInterval);
                this.uiUpdateInterval = null;
            }
        }
    }
    
    let gameInstance = null;
    
    window.addEventListener('load', () => {
        gameInstance = new SatoshiRunner();
    });

    window.addEventListener('beforeunload', () => {
        if (gameInstance) {
            gameInstance.destroy();
        }
    });
