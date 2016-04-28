var request = require('request'),
    ipRange = require('ip-range-check'),
    cloudflareIpRanges = [],
    cloudflareIpRangesUpdatedAt = null,
    cloudflareIpRangesUpdating = false,
    queuedRequests = [],
    debug = require('debug')('express-cf-ip');

function updateCloudflareRanges () {
    var newRanges = [];

    if (cloudflareIpRangesUpdating) {
        return;
    }

    cloudflareIpRangesUpdating = true;

    debug('getting IPV4 ranges from cloudflare');

    request.get('https://www.cloudflare.com/ips-v4', function (error, response) {
        if (error) {
            throw new Error('express-cf-ip:' + error.message);
        }

        newRanges = newRanges.concat(response.body.trim().split('\n'));

        debug('getting IPV6 ranges from cloudflare');

        request.get('https://www.cloudflare.com/ips-v6', function (error, response) {
            if (error) {
                throw new Error('express-cf-ip:' + error.message);
            }

            newRanges = newRanges.concat(response.body.trim().split('\n'));

            cloudflareIpRangesUpdating = false;
            cloudflareIpRanges = newRanges;
            cloudflareIpRangesUpdatedAt = new Date();

            // clear queue
            if (queuedRequests.length) {
                debug('draining request queue of ', queuedRequests.length);

                queuedRequests.forEach(function (queuedRequest) {
                    queuedRequest();
                });
                queuedRequests = [];
            }
        });
    });
}

// update ip list on boot
updateCloudflareRanges();

module.exports = function expressCfIp(request, response, next) {
    // update daily
    if (cloudflareIpRangesUpdatedAt && (new Date() - cloudflareIpRangesUpdatedAt) > 60 * 60 * 24 * 1000) {
        updateCloudflareRanges();
    }

    // queue requests until cloudflares IP's have been set
    if (!cloudflareIpRangesUpdatedAt) {
        return queuedRequests.push(function () {
            expressCfIp(request, response, next);
        });
    }

    // swap IP if cloudflare set it
    if (ipRange(request.ip, cloudflareIpRanges) && (request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'])) {
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