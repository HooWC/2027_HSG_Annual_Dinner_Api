/**
 * Limits concurrent request handlers so many scanners do not overwhelm SQL pool.
 */
class RequestQueue {
    constructor(concurrency = 25) {
        this.concurrency = Math.max(1, concurrency);
        this.running = 0;
        this.queue = [];
    }

    run(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this._drain();
        });
    }

    middleware() {
        return (req, res, next) => {
            this.run(() => new Promise((resolve) => {
                let finished = false;
                const done = () => {
                    if (finished) return;
                    finished = true;
                    resolve();
                };

                res.on('finish', done);
                res.on('close', done);

                next();
            })).catch(next);
        };
    }

    _drain() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift();
            this.running += 1;

            Promise.resolve()
                .then(() => item.task())
                .then(item.resolve, item.reject)
                .finally(() => {
                    this.running -= 1;
                    this._drain();
                });
        }
    }
}

module.exports = RequestQueue;
