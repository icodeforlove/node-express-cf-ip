module.exports = function (request, response, next) {
    if (request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for']) {
        Object.defineProperty(request, 'forwarder_ip', {
            configurable: true,
            enumerable: true,
            value: request.ip
        });
        Object.defineProperty(request, 'ip', {
            configurable: true,
            enumerable: true,
            value: request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for']
        });
    }

    next();
};