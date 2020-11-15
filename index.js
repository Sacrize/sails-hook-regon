const ws = require('ws.js');
const xml2js = require('xml2js');
const _ = require('lodash');
const HttpClientHandler = require('./lib/httpClientHandler');

module.exports = function (sails) {

    let sessionId;

    return {
        defaults: {
            __configKey__: {
                apiUrl: 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc',
                key: '',
                actions: {
                    login: 'http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj',
                    search: 'http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty',
                    fullReport: 'http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DanePobierzPelnyRaport',
                }
            }
        },
        searchByNip: _search,
    };


    function _request(action, message) {
        return new Promise((resolve) => {
            ws.send([
                new ws.Addr('http://schemas.xmlsoap.org/ws/2004/08/addressing'),
                new ws.Mtom(),
                new HttpClientHandler()
            ], {
                request: message,
                url: sails.config.regon.apiUrl,
                action: action,
                contentType: "text/xml",
                headers: {
                    sid: sessionId,
                }
            },
            (ctx) => resolve(ctx.response));
        });
    }

    function _login() {
        return _request(
            sails.config.regon.actions.login,
            `
                <soap:Envelope
                    xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                    xmlns:ns="http://CIS/BIR/PUBL/2014/07">
                    <soap:Header
                        xmlns:wsa="http://www.w3.org/2005/08/addressing">
                        <wsa:Action>${sails.config.regon.actions.login}</wsa:Action>
                        <wsa:To>${sails.config.regon.apiUrl}</wsa:To>
                    </soap:Header>
                    <soap:Body>
                        <ns:Zaloguj>
                            <ns:pKluczUzytkownika>${sails.config.regon.key}</ns:pKluczUzytkownika>
                        </ns:Zaloguj>
                    </soap:Body>
                </soap:Envelope>
            `)
            .then(xml => {
                return new Promise((resolve, reject) => {
                    xml2js.parseString(xml, (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        let sessionId = JSON.stringify(result).match(/"ZalogujResult":\["(\S+)"\]/);
                        if (sessionId[1]) {
                            resolve(sessionId[1]);
                        } else {
                            reject(new Error('Not found session id'));
                        }
                    });
                })
            })
            .then(sid => {
                sessionId = sid;
                return sid;
            });
    }

    function _search(nip) {
        return _login().then(() => {
            return _request(
                sails.config.regon.actions.search,
                `
                    <soap:Envelope
                        xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                        xmlns:ns="http://CIS/BIR/PUBL/2014/07"
                        xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
                        <soap:Header
                            xmlns:wsa="http://www.w3.org/2005/08/addressing">
                            <wsa:Action>${sails.config.regon.actions.search}</wsa:Action>
                            <wsa:To>${sails.config.regon.apiUrl}</wsa:To>
                        </soap:Header>
                        <soap:Body>
                            <ns:DaneSzukajPodmioty>
                                <ns:pParametryWyszukiwania>
                                    <dat:Nip>${nip}</dat:Nip>
                                </ns:pParametryWyszukiwania>
                            </ns:DaneSzukajPodmioty>
                        </soap:Body>
                    </soap:Envelope>
                `)
                .then(xml => {
                    return new Promise((resolve, reject) => {
                        xml2js.parseString(xml, (err, result) => {
                            if (err) {
                                return reject(err);
                            }
                            let data = JSON.stringify(result).match(/"DaneSzukajPodmiotyResult":\["(.+)"\]/);
                            if (data[1]) {
                                data[1] = data[1].replace(/\\r\\n/g, '');
                                xml2js.parseString(data[1], (err, result) => {
                                    if (err) {
                                        return reject(err);
                                    }
                                    let response = result['root']['dane'][0];
                                    if (response) {
                                        resolve(response);
                                    } else {
                                        reject(new Error('Can\'t parse data'));
                                    }
                                });
                            } else {
                                reject(new Error('Not found data'));
                            }
                        });
                    })
                })
                .then(response => {
                    let data = {};
                    for (let key of _.keys(response)) {
                        data[key] = response[key][0] || null;
                    }
                    return data;
                });
        });
    }

}
