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
        this.tools.loop(this.tools, function(member, name, list){
            if (typeof member == "function"){ list[name] = member.bind(this); }
        }, this);

        this.tools.loop(this.console, function(member, name, list){
            if (typeof member == "function"){ list[name] = member.bind(this); }
        }, this);

        this.element = this.tools.toDOM(this.tools.layout("root"));
        this.bodyElement = this.element.querySelector(".body");
        this.inputElement = this.tools.toDOM(this.tools.layout("input"));
        this.inputLine = this.inputElement.querySelector("input");
        this.element.appendChild(this.inputElement);

        this.state = {
            code : ""
        };

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

            this.state.code = this.inputLine.value = "";
            try {
                console.log(eval(code));
            } catch (err){
                console.error(err);
            }
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
        styles : {
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
                "background" : "#fff"
            },
            ".jsterm .body" : {
                "width" : "100%",
                "display" : "flex",
                "flex-direction" : "column",
                "overflow" : "auto",
                "flex-grow" : "1"
            },
            ".input-line, .output-line" : {
                "height" : "32px",
                "display" : "flex",
                "flex-direction" : "row",
                "align-items" : "center",
                "flex-shrink" : "0"
            },
            ".input-line" : {
                "width": "100%",
                "background": "white",
                "box-sizing": "border-box",
                "padding": "0 8px",
            },
            ".input-line:before" : {
                "content": "\">\"",
                "font-family": "monospace",
                "color": "#2196F3",
                "font-weight": "bold",
                "margin-right" : '8px'
            },
            ".input-line input" : {
                "border" : "none",
                "outline" : "none",
                "font-size" : "16px",
                "font-family" : "monospace"
            },
            ".output-line" : {
                "font-size" : "16px",
                "padding" : "0 8px",
                "min-height" : "32px",
                "max-width" : "100%",
                "overflow-x" : "hidden",
                "text-overflow": "clip",
                "white-space": "nowrap",
            },
            ".output-line.error" : {
                "background" : "#ffc7c9"
            },
            ".output-line.warn" : {
                "background" : "#ffe4c7"
            },  
            ".output-line:last-child" : {
                "border-bottom" : "1px solid #eaeaea"
            }
        },
        layouts : {
            root : [
                "<div class=\"jsterm\">",
                "   <div class=\"body\"></div>",
                "</div>"
            ],
            output : [
                "<div class=\"output-line {{classList}}\">{{outputContent}}</div>"
            ],
            input : [
                "<div class=\"input-line\">",
                "   <input type=\"text\">",
                "</div>"
            ]
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

                        if (result.length > 500){
                            result = result.substring(0, 500) + "...";
                        }

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
        }
    };

    return JSTerm;
        
}));