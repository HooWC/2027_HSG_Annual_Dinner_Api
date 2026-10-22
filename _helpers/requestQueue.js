/**
 * Limits how many scan lookups / check-ins hit SQL at once.
 * Extra requests wait in memory instead of opening unlimited DB connections.
 */
class RequestQueue {
    constructor(concurrency = 20, maxQueue = 400) {
        this.concurrency = Math.max(1, concurrency);
        this.maxQueue = Math.max(this.concurrency, maxQueue);
        this.running = 0;
        this.queue = [];
    }

    get pending() {
        return this.queue.length;
    }

    run(task) {
        return new Promise((resolve, reject) => {
            if (this.running + this.queue.length >= this.maxQueue) {
                const err = new Error('Server is busy. Please scan again in a moment.');
                err.status = 503;
                reject(err);
                return;
            }

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
            })).catch((err) => {
                if (res.headersSent) {
                    return;
                }
                res.status(err.status || 500).json({
                    source: 'api',
                    error: err.message || 'Request failed'
                });
            });
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
