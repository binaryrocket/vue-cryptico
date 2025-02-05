import { SecureRandom } from "./random";
import { aes } from './aes';
import { int2char } from "./jsbn";
import { sha256, MD5 } from "./hash";
import { RSAKey } from "./rsa";

export const cryptico = (function () {

    const my = {};

    aes.Init();

    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    my.b256to64 = function (t) {
        let a, c, n;
        let r = ''
        // let l = 0;
        let s = 0;
        const tl = t.length;
        for (n = 0; n < tl; n++) {
            c = t.charCodeAt(n);
            if (s === 0) {
                r += base64Chars.charAt((c >> 2) & 63);
                a = (c & 3) << 4;
            }
            else if (s === 1) {
                r += base64Chars.charAt((a | (c >> 4) & 15));
                a = (c & 15) << 2;
            }
            else if (s === 2) {
                r += base64Chars.charAt(a | ((c >> 6) & 3));
                // l += 1;
                r += base64Chars.charAt(c & 63);
            }
            // l += 1;
            s += 1;
            if (s === 3) s = 0;
        }
        if (s > 0) {
            r += base64Chars.charAt(a);
            // l += 1;
            r += '=';
            // l += 1;
        }
        if (s === 1) {
            r += '=';
        }
        return r;
    }

    my.b64to256 = function (t) {
        let c, n;
        let r = ''
        let s = 0
        let a = 0;
        const tl = t.length;
        for (n = 0; n < tl; n++) {
            c = base64Chars.indexOf(t.charAt(n));
            if (c >= 0) {
                if (s) r += String.fromCharCode(a | (c >> (6 - s)) & 255);
                s = (s + 2) & 7;
                a = (c << s) & 255;
            }
        }
        return r;
    }

    my.b16to64 = function (h) {
        let i;
        let c;
        let ret = "";
        if (h.length % 2 === 1) {
            h = "0" + h;
        }
        for (i = 0; i + 3 <= h.length; i += 3) {
            c = parseInt(h.substring(i, i + 3), 16);
            ret += base64Chars.charAt(c >> 6) + base64Chars.charAt(c & 63);
        }
        if (i + 1 === h.length) {
            c = parseInt(h.substring(i, i + 1), 16);
            ret += base64Chars.charAt(c << 2);
        }
        else if (i + 2 === h.length) {
            c = parseInt(h.substring(i, i + 2), 16);
            ret += base64Chars.charAt(c >> 2) + base64Chars.charAt((c & 3) << 4);
        }
        while ((ret.length & 3) > 0) ret += "=";
        return ret;
    }

    my.b64to16 = function (s) {
        let ret = "";
        let i;
        let k = 0;
        let slop;
        for (i = 0; i < s.length; ++i) {
            if (s.charAt(i) === "=") break;
            const v = base64Chars.indexOf(s.charAt(i));
            if (v < 0) continue;
            if (k === 0) {
                ret += int2char(v >> 2);
                slop = v & 3;
                k = 1;
            }
            else if (k === 1) {
                ret += int2char((slop << 2) | (v >> 4));
                slop = v & 0xf;
                k = 2;
            }
            else if (k === 2) {
                ret += int2char(slop);
                ret += int2char(v >> 2);
                slop = v & 3;
                k = 3;
            }
            else {
                ret += int2char((slop << 2) | (v >> 4));
                ret += int2char(v & 0xf);
                k = 0;
            }
        }
        if (k === 1) ret += int2char(slop << 2);
        return ret;
    }

    // Converts a string to a byte array.
    my.string2bytes = function (string) {
        const bytes = [];
        for (let i = 0; i < string.length; i++) {
            bytes.push(string.charCodeAt(i));
        }
        return bytes;
    }

    // Converts a byte array to a string.
    my.bytes2string = function (bytes) {
        let string = "";
        for (let i = 0; i < bytes.length; i++) {
            string += String.fromCharCode(bytes[i]);
        }
        return string;
    }

    // Returns a XOR b, where a and b are 16-byte byte arrays.
    my.blockXOR = function (a, b) {
        const xor = new Array(16);
        for (let i = 0; i < 16; i++) {
            xor[i] = a[i] ^ b[i];
        }
        return xor;
    }

    // Returns a 16-byte initialization vector.
    my.blockIV = function () {
        const r = new SecureRandom();
        const IV = new Array(16);
        r.nextBytes(IV);
        return IV;
    }

    // Returns a copy of bytes with zeros appended to the end
    // so that the (length of bytes) % 16 == 0.
    my.pad16 = function (bytes) {
        const newBytes = bytes.slice(0);
        const padding = (16 - (bytes.length % 16)) % 16;
        for (let i = bytes.length; i < bytes.length + padding; i++) {
            newBytes.push(0);
        }
        return newBytes;
    }

    // Removes trailing zeros from a byte array.
    my.depad = function (bytes) {
        let newBytes = bytes.slice(0);
        while (newBytes[newBytes.length - 1] === 0) {
            newBytes = newBytes.slice(0, newBytes.length - 1);
        }
        return newBytes;
    }

    // AES CBC Encryption.
    my.encryptAESCBC = function (plaintext, key) {
        const exkey = key.slice(0);
        aes.ExpandKey(exkey);
        let blocks = my.string2bytes(plaintext);
        blocks = my.pad16(blocks);
        let encryptedBlocks = my.blockIV();
        for (let i = 0; i < blocks.length / 16; i++) {
            let tempBlock = blocks.slice(i * 16, i * 16 + 16);
            const prevBlock = encryptedBlocks.slice((i) * 16, (i) * 16 + 16);
            tempBlock = my.blockXOR(prevBlock, tempBlock);
            aes.Encrypt(tempBlock, exkey);
            encryptedBlocks = encryptedBlocks.concat(tempBlock);
        }
        const ciphertext = my.bytes2string(encryptedBlocks);
        return my.b256to64(ciphertext)
    }

    // AES CBC Decryption.
    my.decryptAESCBC = function (encryptedText, key) {
        const exkey = key.slice(0);
        aes.ExpandKey(exkey);
        encryptedText = my.b64to256(encryptedText);
        const encryptedBlocks = my.string2bytes(encryptedText);
        let decryptedBlocks = [];
        for (let i = 1; i < encryptedBlocks.length / 16; i++) {
            let tempBlock = encryptedBlocks.slice(i * 16, i * 16 + 16);
            const prevBlock = encryptedBlocks.slice((i - 1) * 16, (i - 1) * 16 + 16);
            aes.Decrypt(tempBlock, exkey);
            tempBlock = my.blockXOR(prevBlock, tempBlock);
            decryptedBlocks = decryptedBlocks.concat(tempBlock);
        }
        decryptedBlocks = my.depad(decryptedBlocks);
        return my.bytes2string(decryptedBlocks);
    }

    // Wraps a string to 60 characters.
    my.wrap60 = function (string) {
        let outstr = "";
        for (let i = 0; i < string.length; i++) {
            if (i % 60 === 0 && i !== 0) outstr += "\n";
            outstr += string[i];
        }
        return outstr;
    }

    // Generate a random key for the AES-encrypted message.
    my.generateAESKey = function () {
        const key = new Array(32);
        const r = new SecureRandom();
        r.nextBytes(key);
        return key;
    }

    // Generates an RSA key from a passphrase.
    my.generateRSAKey = function (passphrase, bitlength) {
        Math.seedrandom(sha256.hex(passphrase));
        const rsa = new RSAKey();
        rsa.generate(bitlength, "03");
        return rsa;
    }

    // Returns the ascii-armored version of the public key.
    my.publicKeyString = function (rsakey) {
        const pubkey = my.b16to64(rsakey.n.toString(16));
        return pubkey;
    }

    // Returns an MD5 sum of a publicKeyString for easier identification.
    my.publicKeyID = function (publicKeyString) {
        return MD5(publicKeyString);
    }

    my.publicKeyFromString = function (string) {
        const N = my.b64to16(string.split("|")[0]);
        const E = "03";
        const rsa = new RSAKey();
        rsa.setPublic(N, E);
        return rsa
    }

    my.encrypt = function (plaintext, publickeystring, signingkey) {
        let cipherblock = "";
        const aeskey = my.generateAESKey();
        try {
            const publickey = my.publicKeyFromString(publickeystring);
            cipherblock += my.b16to64(publickey.encrypt(my.bytes2string(aeskey))) + "?";
        }
        catch (err) {
            return { status: "Invalid public key" };
        }
        if (signingkey) {
            const signString = cryptico.b16to64(signingkey.signString(plaintext, "sha256"));
            plaintext += "::52cee64bb3a38f6403386519a39ac91c::";
            plaintext += cryptico.publicKeyString(signingkey);
            plaintext += "::52cee64bb3a38f6403386519a39ac91c::";
            plaintext += signString;
        }
        cipherblock += my.encryptAESCBC(plaintext, aeskey);
        return { status: "success", cipher: cipherblock };
    }

    my.decrypt = function (ciphertext, key) {
        const cipherblock = ciphertext.split("?");
        let aeskey = key.decrypt(my.b64to16(cipherblock[0]));
        if (aeskey == null) {
            return { status: "failure" };
        }
        aeskey = my.string2bytes(aeskey);
        const plaintext = my.decryptAESCBC(cipherblock[1], aeskey).split("::52cee64bb3a38f6403386519a39ac91c::");
        if (plaintext.length === 3) {
            const publickey = my.publicKeyFromString(plaintext[1]);
            const signature = my.b64to16(plaintext[2]);
            if (publickey.verifyString(plaintext[0], signature)) {
                return {
                    status: "success",
                    plaintext: plaintext[0],
                    signature: "verified",
                    publicKeyString: my.publicKeyString(publickey)
                };
            }
            else {
                return {
                    status: "success",
                    plaintext: plaintext[0],
                    signature: "forged",
                    publicKeyString: my.publicKeyString(publickey)
                };
            }
        }
        else {
            return { status: "success", plaintext: plaintext[0], signature: "unsigned" };
        }
    }

    return my;

}());



















































