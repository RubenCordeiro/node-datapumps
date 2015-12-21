'use strict';

const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');

class Buffer extends EventEmitter {

    static defaultBufferSize(size) {

        if (!size) {
            return Buffer._defaultBufferSize;
        }

        Buffer._defaultBufferSize = size;
    }

    constructor(options) {
        options = options || {};

        this.content = options.content || [];
        this.size = options.size || Buffer._defaultBufferSize;
        this._sealed = options.sealed || false;
    }

    isEmpty() {
        return this.content.length == 0;
    }

    isFull() {
        return this.content.length >= this.size;
    }

    getContent() {
        return this.content;
    }

    write(data) {

        if (this._sealed) {
            throw new Error('Cannot write to sealed buffer');
        }

        if (this.isFull()) {
            throw new Error('Buffer is full');
        }

        this.content.push(data);
        this.emit('write', data);

        if (this.isFull()) {
            this.emit('full');
        }
    }

    append(data) {
        this.appendArray([data]);
    }

    appendArray(dataArray) {

        let newSize = this.content.length + dataArray.length;
        if (newSize > this.size) {
            this.size = newSize;
        }

        for (let data of dataArray) {
            this.write(data);
        }
    }

    writeAsync(data) {

        if (!this.isFull()) {
            return Promise.resolve(this.write(data));
        }

        return new Promise((resolve) => {
            this.once('release', () => {
                return resolve(this.writeAsync(data));
            });
        });
    }

    writeArrayAsync(dataArray) {

        if (dataArray.length == 0) {
            return Promise.resolve();
        }

        let result = Promise.pending();
        this._writeArrayItem(dataArray, result, 0);

        return result.promise;
    }

    _writeArrayItem(dataArray, pendingPromise, index) {

        this.writeAsync(dataArray[index])
        .done(() => {

            if (index >= dataArray.length - 1) {
                return pendingPromise.resolve();
            }

            this._writeArrayItem(dataArray, pendingPromise, index + 1);
        });

    }

    read() {

        if (this.isEmpty()) {
            throw new Error('Buffer is empty');
        }

        let result = this.content.shift();
        this.emit('release', result);

        if (this.isEmpty()) {

            this.emit('empty');

            if (this._sealed == true) {
                this.emit('end');
            }
        }

        return result;
    }

    readAsync() {

        if (!this.isEmpty()) {
            return Promise.resolve(this.read());
        }

        return new Promise((resolve) => {
            this.once('write', () => {
                return resolve(this.readAsync());
            });
        });
    }

    seal() {

        if (this._sealed == true) {
            throw new Error('Buffer already sealed');
        }

        this._sealed = true;
        this.emit('sealed');

        if (this.isEmpty()) {
            this.emit('end');
        }
    }

    isSealed() {
        return this._sealed == true;
    }

    isEnded() {
        return this.isSealed() && this.isEmpty();
    }
}

Buffer._defaultBufferSize = 10;

module.exports = Buffer;
