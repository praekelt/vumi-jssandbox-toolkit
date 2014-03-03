var Q = require("q");
var assert = require("assert");

var vumigo = require("../../lib");
var test_utils = vumigo.test_utils;
var MetricStore = vumigo.metrics.api.MetricStore;


describe("metrics.api", function() {
    var im;
    var metrics;

    beforeEach(function() {
        return test_utils.make_im().then(function(new_im) {
            im = new_im;
            metrics = im.metrics;
        });
    });

    describe("MetricStore", function() {
        describe(".setup", function() {
            var metrics;

            beforeEach(function() {
                metrics = new MetricStore(im);
            });

            it("should emit a 'setup' event", function() {
                var p = metrics.once.resolved('setup');
                return metrics.setup().thenResolve(p);
            });
        });

        describe(".fire", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire('yaddle-the-metric', 23,  'sum')
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire('yoda_the_metric', 23,  'sum'),
                    metrics.fire('yoda_the_metric', 42,  'sum'),
                    metrics.fire('yaddle_the_metric', 22,  'avg')
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'sum',
                                values: [23, 42]
                            },
                            yaddle_the_metric: {
                                agg: 'avg',
                                values: [22]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.sum", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.sum('yaddle-the-metric', 23)
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.sum('yoda_the_metric', 23),
                    metrics.fire.sum('yoda_the_metric', 42),
                    metrics.fire.sum('yaddle_the_metric', 22)
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'sum',
                                values: [23, 42]
                            },
                            yaddle_the_metric: {
                                agg: 'sum',
                                values: [22]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.avg", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.avg('yaddle-the-metric', 23)
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.avg('yoda_the_metric', 23),
                    metrics.fire.avg('yoda_the_metric', 42),
                    metrics.fire.avg('yaddle_the_metric', 22)
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'avg',
                                values: [23, 42]
                            },
                            yaddle_the_metric: {
                                agg: 'avg',
                                values: [22]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.min", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.min('yaddle-the-metric', 23)
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.min('yoda_the_metric', 23),
                    metrics.fire.min('yoda_the_metric', 42),
                    metrics.fire.min('yaddle_the_metric', 22)
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'min',
                                values: [23, 42]
                            },
                            yaddle_the_metric: {
                                agg: 'min',
                                values: [22]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.max", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.max('yaddle-the-metric', 23)
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.max('yoda_the_metric', 23),
                    metrics.fire.max('yoda_the_metric', 42),
                    metrics.fire.max('yaddle_the_metric', 22)
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'max',
                                values: [23, 42]
                            },
                            yaddle_the_metric: {
                                agg: 'max',
                                values: [22]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.inc", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.inc('yaddle-the-metric')
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.inc('yoda_the_metric'),
                    metrics.fire.inc('yoda_the_metric'),
                    metrics.fire.inc('yaddle_the_metric')
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'sum',
                                values: [1, 1]
                            },
                            yaddle_the_metric: {
                                agg: 'sum',
                                values: [1]
                            }
                        }
                    });
                });
            });
        });

        describe(".fire.last", function() {
            it("should return the status of the fire call", function() {
                return metrics
                    .fire.last('yaddle-the-metric', 23)
                    .then(function(success) {
                        assert(success);
                    });
            });

            it("should record the metric", function() {
                assert.deepEqual(im.api.metrics.stores, {});

                return Q.all([
                    metrics.fire.last('yoda_the_metric', 1),
                    metrics.fire.last('yoda_the_metric', 2),
                    metrics.fire.last('yaddle_the_metric', 3)
                ]).then(function() {
                    assert.deepEqual(im.api.metrics.stores, {
                        test_app:{
                            yoda_the_metric: {
                                agg: 'last',
                                values: [1, 2]
                            },
                            yaddle_the_metric: {
                                agg: 'last',
                                values: [3]
                            }
                        }
                    });
                });
            });
        });
    });
});
