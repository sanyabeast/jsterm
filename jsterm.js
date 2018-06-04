"use strict";
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory(true);
    } else {
        var JSTerm = factory();
        window.JSTerm = JSTerm;
    }
}(this, function(){

    var JSTerm = function(){
        var _this = this;

        this.state = {
            saveCodeToHistory : true,
            code : "",
            zoom : 1,
            zoomMin : 0.4,
            zoomMax : 4,
            zoomStep : 0.2,
            history : [],
            _historyPosition : 0,
            _connected : false,
            set connected(v){
                this._connected = v;
                if (v){
                    _this.element.classList.add("connected");
                } else {
                    _this.element.classList.remove("connected");
                }
            },
            get connected(){
                return this._connected;
            },
            set historyPosition(v){
                this._historyPosition = v;
                this.code = _this.inputLine.value = this.history[v] || "";
                this.saveCodeToHistory = false;
            },
            get historyPosition(){ return this._historyPosition }
        };

        this.tools.loop(this.tools, function(member, name, list){
            if (typeof member == "function"){ list[name] = member.bind(this); }
        }, this);

        this.tools.loop(this.console, function(member, name, list){
            if (typeof member == "function"){ list[name] = member.bind(this); }
        }, this);

        this.element = this.tools.toDOM(this.tools.layout("root"));
        this.bodyElement = this.element.querySelector(".body");
        this.menuElement = this.element.querySelector(".menu");
        this.inputElement = this.tools.toDOM(this.tools.layout("input"));
        this.inputLine = this.inputElement.querySelector("input");
        this.element.appendChild(this.inputElement);

        this.setupMenu(this.menuElement);

        this.inputLine.addEventListener("input", function(){
            this.state.saveCodeToHistory = true;
            this.state.code = this.inputLine.value;
        }.bind(this));

        this.inputLine.addEventListener("keypress", function(evt){
            if (evt.code == "Enter" || evt.key == "Enter" || evt.keyCode == 13 || evt.chartCode == 13){
                this.evalInput();
            }
        }.bind(this));

        this.realConsole = window.console;
        this.fakeConsole = new Proxy(window.console, {
            get : function(console, prop){
                return (typeof this.console[prop] == "function") ? this.console[prop] : console[prop];
            }.bind(this)
        });

        this.addStyles();
    };
    
    JSTerm.prototype = {
        connect : function(){
            this.state.connected = true;
            window.console = this.fakeConsole;
        },
        diconnect : function(){
            this.state.connected = false;
            window.console = this.realConsole;
        },  
        toggleConnection : function(){
            this.state.connected ? this.diconnect() : this.connect();
        },
        evalInput : function(){
            if (!this.state.connected){
                this.throwDisconnectionError();
                return;
            }

            var code = this.state.code;
            var saveCodeToHistory = this.state.saveCodeToHistory;

            if (code.length == 0){
                return;
            }

            this.state.historyPosition = 0;
            this.state.code = this.inputLine.value = "";
            try {
                console.log(eval(code));
            } catch (err){
                console.error(err);
            }

            if (saveCodeToHistory){
                this.state.history.push(code);
            }
        },
        throwDisconnectionError : function(){
            this.console.$output("error", ["JSTerm is not connected"]);
        },
        setupMenu : function(element){
            element.querySelector(".button.zoom-increase").addEventListener("click", function(evt){
                if (this.state.zoom + this.state.zoomStep <= this.state.zoomMax){
                    this.state.zoom += this.state.zoomStep;
                    this.element.style.fontSize = this.state.zoom + "px";                    
                }
            }.bind(this));

            element.querySelector(".button.zoom-decrease").addEventListener("click", function(evt){
                if (this.state.zoom - this.state.zoomStep >= this.state.zoomMin){
                    this.state.zoom -= this.state.zoomStep;
                    this.element.style.fontSize = this.state.zoom + "px";                    
                }
            }.bind(this));

            element.querySelector(".button.prev").addEventListener("click", function(evt){
                this.state.historyPosition--;
                if (this.state.historyPosition < 0) this.state.historyPosition = this.state.history.length - 1;
            }.bind(this));

            element.querySelector(".button.next").addEventListener("click", function(evt){
                this.state.historyPosition++;
                if (this.state.historyPosition >= this.state.history.length) this.state.historyPosition = 0;
            }.bind(this));

            element.querySelector(".button.eval").addEventListener("click", function(evt){
                this.evalInput();
            }.bind(this));

            element.querySelector(".button.clear").addEventListener("click", function(evt){
                this.bodyElement.innerHTML = "";
            }.bind(this));
        },
        addStyles : function(){
            var styleElement = document.createElement("style");
            styleElement.type = "text/css";
            document.getElementsByTagName("head")[0].appendChild(styleElement);
            styleElement.innerText = this.genCSS(this.styles);
        },
        genCSS : function(styles){
            var result = "";

            this.tools.loop(styles, function(style, selector){
                result += selector;
                result += "{";
                this.tools.loop(style, function(value, token){
                    result += token;
                    result += ":";
                    result += value;
                    result += ";";
                });

                result += "} ";
            }, this);

            return result;
        },
        tools : {
            join : function(){ Array.prototype.join.call(arguments, ""); },
            loop : function(list, cb, ctx){
                if (list instanceof Array) for(var a=0,l=list.length;a<l;a++){cb.call(ctx,list[a],a,list);}
                else for(var a in list){cb.call(ctx,list[a],a,list);};
                return list;
            },
            template : function(string, settings){
                settings = settings || {};

                var matches = string.match(/\{{[^${]*}}/g) || [];
                var vars = [];

                this.tools.loop(matches, function(match, a){
                    name = match.substring(2, match.length - 2);
                    if (vars.indexOf(name) < 0) vars.push(name);
                }, this);

                this.tools.loop(vars, function(_var, a){
                    string = string.replace(new RegExp("\\{{" + _var + "}}", "g"), this.tools.process(_var, settings) || "undefined");
                }, this);

                return string;
            },
            layout : function(id, settings){
                var html = this.tools.template(this.layouts[id].join(""), settings);
                return html;
            },
            process : function(token, settings){
                if (token.indexOf("#") == 0){
                    token = this.tools.layout(token.replace("#", ""), settings);
                } else {
                    token = settings[token];
                }

                token = token.toString();
                return token;
            },
            toDOM : function(html){
                return new DOMParser().parseFromString(html, "text/html").body.children[0];
            },
            listReplace : function(list, replacer, ctx){
                return this.tools.loop(list, function(item, id, list){
                    list[id] = replacer.call(ctx, item, id, list);
                }, ctx);
            }
        },
        console : {
            $format : function(args){
                var result = this.tools.listReplace(args, function(item, id){
                    if (item instanceof Error){
                        return item;
                    }

                    return this.console.$stringify(item);
                }, this).join(" ");

                return result;
            },
            $stringify : function(token, noJSON){
                try {
                    if (typeof token == "object" && noJSON !== true){
                        var result = {};

                        this.tools.loop(token, function(member, name){
                            result[name] = this.console.$stringify(member, true);
                        }, this);

                        this.realConsole.log(result);
                        result = JSON.stringify(result, null, "\t");
                        return result;

                    } else if (typeof token !== "function"){
                        return JSON.stringify(token);                        
                    } else {
                        eturn (token || "undefined").toString();
                    }

                } catch (err){
                    return (token || "undefined").toString();
                }
            },
            $output : function(type, args){
                this.realConsole[type].apply(this.realConsole, args);
                this.bodyElement.appendChild(this.tools.toDOM(this.tools.layout("output", {
                    classList : type,
                    outputContent : this.console.$format(args)
                })));

                this.bodyElement.scrollTop = this.bodyElement.scrollHeight;
            },
            /*------------------------------*/
            log : function(){
                this.console.$output("log", Array.prototype.slice.apply(arguments));
            },
            error : function(){
                this.console.$output("error", Array.prototype.slice.apply(arguments));
            },
            warn : function(){
                this.console.$output("warn", Array.prototype.slice.apply(arguments));
            },
            info : function(){
                this.console.$output("info", Array.prototype.slice.apply(arguments));
            },
        },
        styles : {
            ".jsterm ::-webkit-scrollbar" : {
              "width": "2px",
              "height": "2px",
            },
            ".jsterm ::-webkit-scrollbar-button" : {
              "width": "0px",
              "height": "0px",
            },
            ".jsterm ::-webkit-scrollbar-thumb" : {
              "background": "#e1e1e1",
              "border": "0px none #ffffff",
              "border-radius": "50px",
            },
            ".jsterm ::-webkit-scrollbar-thumb:hover" : {
              "background": "#ffffff",
            },
            ".jsterm ::-webkit-scrollbar-thumb:active" : {
              "background": "#000000",
            },
            ".jsterm ::-webkit-scrollbar-track" : {
              "background": "#666666",
              "border": "0px none #ffffff",
              "border-radius": "50px",
            },
            ".jsterm ::-webkit-scrollbar-track:hover" : {
              "background": "#666666",
            },
            ".jsterm ::-webkit-scrollbar-track:active" : {
              "background": "#333333",
            },
            ".jsterm ::-webkit-scrollbar-corner" : {
              "background": "transparent",
            },
            ".jsterm" : {
                "display" : "flex",
                "flex-direction" : "column",
                "min-width" : "100px",
                "min-height" : "100px",
                "font-size" : "16px",
                "border" : "1px solid #ccc",
                "box-sizing": "border-box",
                "font-family" : "monospace",
                "overflow" : "auto",
                "background" : "#fff",
                "font-size" : "1px",
                "-webkit-tap-highlight-color": "transparent"
            },
            ".jsterm .menu" : {
                "height" : "32em",
                "flex-shrink" : "0",
                "display" : "flex",
                "flex-direction" : "row",
                "border-bottom": "1px solid #f7f7f7",
                "justify-content": "flex-end",
                "background": "#f3f3f3"
            },
            ".jsterm .menu .button" : {
                "height" : "32em",
                "width" : "32em",
                "text-align" : "center",
                "color": "#969696",
                "font-weight" : "bold",
                "border-left": "1px dotted #adadad",
                "margin-left": "-1px",
                "cursor": "pointer",
                "box-sizing": "border-box",
                "user-select" : "none",
                "display" : "flex",
                "align-items" : "center",
                "justify-content" : "center"
            },
            ".jsterm .menu .button p" : {
                "margin" : "0",
                "font-size" : "24em",
            },
            ".jsterm .body" : {
                "width" : "100%",
                "display" : "flex",
                "flex-direction" : "column",
                "overflow" : "auto",
                "flex-grow" : "1"
            },
            ".jsterm .input-line, .output-line" : {
                "height" : "2em",
                "display" : "flex",
                "flex-direction" : "row",
                "align-items" : "center",
                "flex-shrink" : "0"
            },
            ".jsterm .input-line" : {
                "width": "100%",
                "background": "white",
                "box-sizing": "border-box",
                "padding": "0 8em",
                "height" : "32em"
            },
            ".jsterm .input-line:before" : {
                "content": "\">\"",
                "font-family": "monospace",
                "color": "#2196F3",
                "font-weight": "bold",
                "margin-right" : '0.5em',
                "font-size" : "16em"
            },
            ".jsterm .input-line input" : {
                "border" : "none",
                "outline" : "none",
                "font-size" : "16em",
                "font-family" : "monospace",
                "flex-grow" : "1",
                "height" : "100%",
                "box-sizing" : "border-box"
            },
            ".jsterm .output-line" : {
                "font-size" : "16em",
                "padding" : "0 0.5em",
                "min-height" : "2em",
                "max-height" : "10em",
                "max-width" : "100%",
                "overflow-x" : "hidden",
                "overflow-y" : "auto",
                "white-space": "pre",
                "height" : "auto",
                "border-bottom": "1px solid #f3f3f3",
                "align-items" : "flex-start",
                "position" : "relative",
                "tab-size" : "2em"
            },
            ".jsterm .output-line p" : {
                "margin" : "auto 0",
                "user-select" : "auto"
            },
            ".jsterm .output-line:before" : {
                "content": "\"<\"",
                "font-family": "monospace",
                "color": "#505050",
                "font-weight": "bold",
                "margin-right" : '0.5em',
                "font-size" : "1em",
                "align-self" : "flex-start",
                "margin-top": "0.4em",
            },
            ".jsterm .output-line.error" : {
                "background" : "#ffc7c9"
            },
            ".jsterm .output-line.warn" : {
                "background" : "#ffe4c7"
            },  
            ".jsterm .output-line:last-child" : {
                "border-bottom" : "1px solid #eaeaea"
            }
        },
        layouts : {
            root : [
                "<div class=\"jsterm\">",
                "   {{#menu}}",
                "   <div class=\"body\"></div>",
                "</div>"
            ],
            menu : [
                "<div class=\"menu\">",
                "   <div title=\"Eval\" class=\"button eval\"><p>&#10003</p></div>",
                "   <div title=\"Clear console\" class=\"button clear\"><p>&#10799</p></div>",
                "   <div title=\"Prev\" class=\"button prev\"><p>&#8593</p></div>",
                "   <div title=\"Next\" class=\"button next\"><p>&#8595</p></div>",
                "   <div title=\"Zoom-out\" class=\"button zoom-decrease\"><p>-</p></div>",
                "   <div title=\"Zoom-in\" class=\"button zoom-increase\"><p>+</p></div>",
                "</div>"
            ],
            output : [
                "<div class=\"output-line {{classList}}\">",
                "   <p>{{outputContent}}</p>",
                "</div>"
            ],
            input : [
                "<div class=\"input-line\">",
                "   <input autocorrect=\"off\" autocapitalize=\"none\" type=\"text\">",
                "</div>"
            ]
        },
    };

    return JSTerm;
        
}));