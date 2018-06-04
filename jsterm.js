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
            code : "",
            zoom : 1,
            zoomMin : 0.4,
            zoomMax : 4,
            zoomStep : 0.2,
            history : [],
            _historyPosition : 0,
            set historyPosition(v){
                this._historyPosition = v;
                _this.code = _this.inputLine.value = this.history[v];
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
            this.state.code = this.inputLine.value;
        }.bind(this));

        this.inputLine.addEventListener("keypress", function(evt){
            if (evt.code == "Enter" || evt.key == "Enter" || evt.keyCode == 13 || evt.chartCode == 13){
                this.evalInput();
            }
        }.bind(this));

        this.realConsole = window.console;
        window.console = new Proxy(window.console, {
            get : function(console, prop){
                return (typeof this.console[prop] == "function") ? this.console[prop] : console[prop];
            }.bind(this)
        });

        this.addStyles();
    };
    
    JSTerm.prototype = {
        evalInput : function(){
            var code = this.state.code;
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

            this.state.history.push(code);
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
                "font-size" : "1px"
            },
            ".jsterm .menu" : {
                "height" : "32em",
                "flex-shrink" : "0",
                "display" : "flex",
                "flex-direction" : "row",
                "border-bottom": "1px solid #f7f7f7",
                "justify-content": "flex-end",
            },
            ".jsterm .menu .button" : {
                "height" : "2em",
                "width" : "2em",
                "font-size" : "16em",
                "line-height": "2em",
                "text-align" : "center",
                "color": "#969696",
                "font-weight" : "bold",
                "border": "1px solid #f1f1f1",
                "border-bottom" : "none",
                "margin-left": "-1px",
                "cursor": "pointer",
                "box-sizing": "border-box",
                "user-select" : "none"
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
                "margin" : "auto 0"
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
                "   <div class=\"button prev\">&#8593</div>",
                "   <div class=\"button next\">&#8595</div>",
                "   <div class=\"button zoom-decrease\">-</div>",
                "   <div class=\"button zoom-increase\">+</div>",
                "</div>"
            ],
            output : [
                "<div class=\"output-line {{classList}}\">",
                "   <p>{{outputContent}}</p>",
                "</div>"
            ],
            input : [
                "<div class=\"input-line\">",
                "   <input type=\"text\">",
                "</div>"
            ]
        },
    };

    return JSTerm;
        
}));