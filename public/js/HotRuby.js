/**
 * HotRuby
 * @class
 * @construtor
 */
var HotRuby = function() {
	/** 
	 * Global Variables
	 * @type Object 
	 */
	this.globalVars = {
		"$native": {
			__className : "NativeEnviornment",
			__instanceVars : {}
		}
	};
	/** 
	 * END blocks
	 * @type Array 
	 */
	this.endBlocks = [];
	/**
	 * Running Enviornment
	 * @type String
	 */
	this.env = "browser";
	/** nil object */
	this.nilObj = {
		__className : "NilClass",
		__native : null
	};
	/** true object */
	this.trueObj = {
		__className : "TrueClass",
		__native : true
	};
	/** false object */
	this.falseObj = {
		__className : "FalseClass",
		__native : false
	};
	this.topObject = {
		__className : "Object",
		__native : {}
	};
	this.topSF = null;

	this.loaded_feature = {};
	
	this.checkEnv();
};

/**
 * StackFrame
 * @class
 * @construtor
 */
HotRuby.StackFrame = function() {
	/** 
	 * Stack Pointer
	 * @type Number 
	 */
	this.sp = 0;
	/** 
	 * Local Variables
	 * @type Array 
	 */
	this.localVars = [];
	/** 
	 * Stack 
	 * @type Array 
	 */
	this.stack = [];
	/** 
	 * Current class to define methods
	 * @type Object 
	 */
	this.classObj = null;
	/** 
	 * Current method name
	 * @type String 
	 */
	this.methodName = "";
	/** 
	 * Current line no
	 * @type Number 
	 */
	this.lineNo = 0;
	/** 
	 * File name
	 * @type String 
	 */
	this.fileName = "";
	/** 
	 * self
	 * @type Object 
	 */
	this.self = null;
	/** 
	 * Parent StackFrame
	 * @type HotRuby.StackFrame 
	 */
	this.parentStackFrame = null;
	/** 
	 * Is Proc(Block)
	 * @type boolean 
	 */
	this.isProc = false;
	/** 
	 * Object Specific class
	 * @type Object 
	 */
	this.cbaseObj = null;
};

HotRuby.prototype = {
	/**
	 * Run the script.
 	 * @param {Array} opcode
	 */
	run : function(opcode) {
		//try {
			this.runOpcode(opcode, this.classes.Object, null, this.topObject, [], null, false, null);
		//} catch(e) {
		//	this.printDebug(e);
		//}
	},
	
	/**
	 * Run the opcode.
	 * @param {Array} opcode
	 * @param {Object} classObj
	 * @param {String} methodName
	 * @param {Object} self
	 * @param {Array} args
	 * @param {HotRuby.StackFrame} parentSF Parent StackFrame
	 * @param {boolean} isProc
	 * @param {Object} cbaseObj
	 * @private
	 */
	runOpcode : function(opcode, classObj, methodName, self, args, parentSF, isProc, cbaseObj) {
		if (args.length < opcode[4].arg_size) {
			throw "Argument Error in " + parentSF.lineNo + ": Wrong number of arguments (" + args.length + " for " + opcode[4].arg_size + ")";
		}
		// Create Stack Frame
		var sf = new HotRuby.StackFrame();
		sf.localVars = new Array(opcode[4].local_size + 1);
		sf.stack = new Array(opcode[4].stack_max);
		sf.fileName = opcode[6];
		sf.classObj = classObj;
		sf.methodName = methodName;
		sf.self = self;
		sf.parentStackFrame = parentSF;
		sf.isProc = isProc;
		sf.cbaseObj = cbaseObj;
		
		if(this.topSF == null) this.topSF = sf;
		
		// Copy args to localVars. Fill from last.
		for (var i = 0;i < opcode[4].arg_size; i++) {
			sf.localVars[sf.localVars.length - 1 - i] = args[i];
		}
		try {
			// Run the mainLoop
			this.mainLoop(opcode[11], sf);	// for Ruby 1.9.0
			//this.mainLoop(opcode[13], sf);	// for Ruby 1.9.2
			
			// Copy the stack to the parent stack frame
			if (parentSF != null) {
				for (var i = 0; i < sf.sp; i++) {
					parentSF.stack[parentSF.sp++] = sf.stack[i];
				}
			}
			else {
				// Run END blocks
				if (this.endBlocks.length > 0) {
					this.run(this.endBlocks.pop());
				}
			}
		} catch (e) {
			this.gotoLine(sf.lineNo);
			if (e.name == "TypeError") {
				this.printDebug(sf.lineNo);				
			} 
			this.printDebug(e);
			throw e;
		}

    	//this.invokeMethod(sf.stack[0], "inspect", [], sf, 0, true);
    	return sf.stack[0];
	},
	
	/**
	 * Main loop for opcodes.
	 * @param {Array} opcode
	 * @param {HotRuby.StackFrame} sf
	 * @private
	 */
	mainLoop : function(opcode, sf) {
		// Create label to ip
		if(!("label2ip" in opcode)) {
			opcode.label2ip = {};
			for (var ip = 0;ip < opcode.length; ip++) {
				// If "cmd is a String then it is a jump label
				var cmd = opcode[ip];
				if (typeof(cmd) == "string") {
					opcode.label2ip[cmd] = ip;
					opcode[ip] = null;
				}
			}
		}
		
		for (var ip = 0;ip < opcode.length; ip++) {
			// Get the next command
			var cmd = opcode[ip];
			if (cmd == null)
				continue;

			// If "cmd" is a Number then it is the line number.
			if (typeof(cmd) == "number") {
				sf.lineNo = cmd;
				continue;
			}
			// "cmd" must be an Array
			if (!(cmd instanceof Array))
				continue;
			
			//console.trace("cmd = " + cmd[0] + ", sp = " + sf.sp);
			switch (cmd[0]) {
				/* // Ruby 1.9.2 のバイトコード：保留
				case "trace" :
					break;
				case "putspecialobject" :
					switch (cmd[1]) {
						case 1:
							//sf.stack[sf.sp++] = "frozencore";
							break;
						case 2:
							sf.stack[sf.sp++] = sf.cbaseObj;
							break;
						case 3:
							//TODO
							break;
						default:
							//TODO
							break;
					}
					//sf.stack[sf.sp++] = sf.classObj;
					break;
				case "putiseq" :
					sf.stack[sf.sp++] = this.createRubyISeq(cmd[1]);
					break;
					*/
				case "jump" :
					ip = opcode.label2ip[cmd[1]];
					break;
				case "branchif" :
					var val = sf.stack[--sf.sp];
					if(val != this.nilObj && val != this.falseObj) {
						ip = opcode.label2ip[cmd[1]];
					}
					break;
				case "branchunless" :
					var val = sf.stack[--sf.sp];
					if(val == this.nilObj || val == this.falseObj) {
						ip = opcode.label2ip[cmd[1]];
					}
					break;
				case "opt_case_dispatch":
					var v = sf.stack[--sf.sp];
					if(typeof(v) != "number") v = v.__native;
					for(var i=0; i<cmd[1].length; i+=2) {
						if(v === cmd[1][i]) {
							ip = opcode.label2ip[cmd[1][i+1]];
							break;
						}
					}
					if(i == cmd[1].length) {
						ip = opcode.label2ip[cmd[2]];
					}
					break;
				case "leave" :
					return;
				case "putnil" :
					sf.stack[sf.sp++] = this.nilObj;
					break;
				case "putself" :
					sf.stack[sf.sp++] = sf.self;
					break;
				case "putobject" :
					var value = cmd[1];
					switch(typeof(value)) {
					case "string" :
						if (value.match(/^(\d+)(\.\.*)(\d+)$/)) {
							value = this.createRubyRange(
								parseInt(RegExp.$3), 
								parseInt(RegExp.$1), 
								RegExp.$2.length == 3);
						} else {
							value = this.createRubyString(value);
						}
						break;
					case "boolean" :
						value = (value)? this.trueObj : this.falseObj; 
						break;
					}
					sf.stack[sf.sp++] = value;
					break;
				case "putstring" :
					sf.stack[sf.sp++] = this.createRubyString(cmd[1]);
					break;
				case "tostring" :
					var recver = sf.stack[--sf.sp];
					this.invokeMethod(recver, "to_str", [], sf, cmd[4], false);
					break;
				case "concatstrings" :
					var num = cmd[1];
					var cat = sf.stack[sf.sp - num].__native;
					while (--num > 0) {
						cat += sf.stack[sf.sp - num].__native;
					}
					sf.sp -= cmd[1];
					sf.stack[sf.sp++] = this.createRubyString(cat);
					break;
				case "newarray" :
					var value = this.createRubyArray(sf.stack.slice(sf.sp - cmd[1], sf.sp));
					sf.sp -= value.__native.length;
					sf.stack[sf.sp++] = value;
					break;
				case "duparray" :
					sf.stack[sf.sp++] = this.createRubyArray(cmd[1]);
					break;
				case "expandarray" :
					var ary = sf.stack[--sf.sp];
					if(typeof(ary) == "object" && ary.__className == "Array") {
						var size = cmd[1];
						for(var i = 0; i < size; i++) {
							sf.stack[sf.sp++] = ary.__native[size - i - 1];						
						}
						if(cmd[2] && 1) {
							// TODO
						}
						if(cmd[2] && 2) {
							// TODO
						}
						if(cmd[2] && 4) {
							// TODO
						}
					} else {
						sf.stack[sf.sp++] = ary;
						for (var i = 0;i < cmd[1] - 1; i++) {
							sf.stack[sf.sp++] = this.nilObj;
						}
					}
					break;
				case "newhash" :
					var hash = this.createRubyHash(sf.stack.slice(sf.sp - cmd[1], sf.sp));
					sf.sp -= cmd[1];
					sf.stack[sf.sp++] = hash;
					break;
				case "newrange" :
					var value = this.createRubyRange(sf.stack[--sf.sp], sf.stack[--sf.sp], cmd[1]);
					sf.stack[sf.sp++] = value;
					break;
				case "setlocal" :
					var localSF = sf;
					while (localSF.isProc) {
						localSF = localSF.parentStackFrame;
					}
					localSF.localVars[cmd[1]] = sf.stack[--sf.sp];
					break;
				case "getlocal" :
					var localSF = sf;
					while (localSF.isProc) {
						localSF = localSF.parentStackFrame;
					}
					sf.stack[sf.sp++] = localSF.localVars[cmd[1]];
					break;
				case "setglobal" :
					this.globalVars[cmd[1]] = sf.stack[--sf.sp];
					break;
				case "getglobal" :
					sf.stack[sf.sp++] = this.globalVars[cmd[1]];
					break;
				case "setconstant" :
					this.setConstant(sf, sf.stack[--sf.sp], cmd[1], sf.stack[--sf.sp]);
					break;
				case "getconstant" :
					var value = this.getConstant(sf, sf.stack[--sf.sp], cmd[1]);
					sf.stack[sf.sp++] = value;
					break;
				case "setinstancevariable" :
					sf.self.__instanceVars[cmd[1]] = sf.stack[--sf.sp];
					break;
				case "getinstancevariable" :
					sf.stack[sf.sp++] = sf.self.__instanceVars[cmd[1]];
					break;
				case "setclassvariable" :
					sf.classObj.__classVars[cmd[1]] = sf.stack[--sf.sp];
					break;
				case "getclassvariable" :
					var searchClass = sf.classObj;
					while (true) {
						if (cmd[1] in searchClass.__classVars) {
							sf.stack[sf.sp++] = searchClass.__classVars[cmd[1]];
							break;
						}
						searchClass = searchClass.__parentClass;
						if (searchClass == null) {
							throw "Cannot find class variable : " + cmd[1];
						}
					}
					break;
				case "getdynamic" :
					var lookupSF = sf;
					var idx = cmd[1];
					var level = cmd[2];
					for (var i = 0; i < level; i++) {
						lookupSF = lookupSF.parentStackFrame;
					}
					sf.stack[sf.sp++] = lookupSF.localVars[idx];
					break;
				case "setdynamic" :
					var lookupSF = sf;
					for (var i = 0;i < cmd[2]; i++) {
						lookupSF = lookupSF.parentStackFrame;
					}
					lookupSF.localVars[cmd[1]] = sf.stack[--sf.sp];
					break;
//				case "getspecial" :
//					break;
//				case "setspecial" :
//					break;
				case "pop" :
					sf.sp--;
					break;
				case "dup" :
					sf.stack[sf.sp] = sf.stack[sf.sp - 1];
					sf.sp++;
					break;
				case "dupn" :
					for (var i = 0;i < cmd[1]; i++) {
						sf.stack[sf.sp + i] = sf.stack[sf.sp + i - cmd[1]];
					}
					sf.sp += cmd[1];
					break;
				case "swap" :
					var tmp = sf.stack[sf.sp - 1];
					sf.stack[sf.sp - 1] = sf.stack[sf.sp - 2];
					sf.stack[sf.sp - 2] = tmp;
					break;
				case "topn" :
					sf.stack[sf.sp] = sf.stack[sf.sp - cmd[1]];
					sf.sp++;
					break;
				case "setn" :
					sf.stack[sf.sp - cmd[1]] = sf.stack[sf.sp - 1];
					break;
				case "emptstack" :
					sf.sp = 0;
					break;
				case "send" :
					var args = sf.stack.slice(sf.sp - cmd[2], sf.sp);
					sf.sp -= cmd[2];
					var recver = sf.stack[--sf.sp];
					if(cmd[4] & HotRuby.VM_CALL_FCALL_BIT) {
						recver = sf.self;
					}
					if(cmd[3] instanceof Array)
						cmd[3] = this.createRubyProc(cmd[3], sf);
					if(cmd[3] != null)
						args.push(cmd[3]);
					this.invokeMethod(recver, cmd[1], args, sf, cmd[4], false);
					break;
				case "invokesuper" :
					var args = sf.stack.slice(sf.sp - cmd[1], sf.sp);
					sf.sp -= cmd[1];
					// TODO When to use this autoPassAllArgs?
					var autoPassAllArgs = sf.stack[--sf.sp];
					if(cmd[2] instanceof Array)
						cmd[2] = this.createRubyProc(cmd[1], sf);
					if(cmd[2] != null)
						args.push(cmd[2]);
					this.invokeMethod(sf.self, sf.methodName, args, sf, cmd[3], true);
					break;
				case "definemethod" :
					var obj = sf.stack[--sf.sp];
					if(sf.cbaseObj != null)
						obj = sf.cbaseObj;
					if (obj == null || obj == this.nilObj) {
						sf.classObj[cmd[1]] = cmd[2];
					} else {
						if (!("__methods" in obj))
						//if(typeof(obj.__methods) == "undefined")
							obj.__methods = {};
						obj.__methods[cmd[1]] = cmd[2];
					}
					opcode[ip] = null;
					opcode[ip - 1] = null;
					break;
				case "defineclass" :
					var parentClass = sf.stack[--sf.sp];
					var isRedefine = (parentClass == this.falseObj);
					if(parentClass == null || parentClass == this.nilObj)
						parentClass = this.classes.Object;
					var cbaseObj = sf.stack[--sf.sp];
					if(cmd[3] == 0) {
						// Search predefined class
						var newClass = this.getConstant(sf, sf.classObj, cmd[1]);
						if(newClass == null || isRedefine) {
							// Create class object
							var newClass = {
								__className : cmd[1],
								__parentClass : parentClass,
								__constantVars : {},
								__classVars : {}
							};
							this.classes[cmd[1]] = newClass;
							sf.self = newClass; // 特異メソッド定義のため
							// Puts the className to CONSTANT
							this.setConstant(sf, sf.classObj, cmd[1], newClass);
						}
						// Run the class definition
						this.runOpcode(cmd[2], newClass, null, sf.self, [], sf, false, null);
					} else if(cmd[3] == 1) {
						// Object-Specific Classes
						if(cbaseObj == null || typeof(cbaseObj) != "object")
							throw "Not supported Object-Specific Classes on Primitive Object"
						// Run the class definition
						this.runOpcode(cmd[2], cbaseObj.__className, null, sf.self, [], sf, false, cbaseObj);
					} else 	if(cmd[3] == 2) {
						// TODO 
						throw "Not implemented";
					}
					break;
				case "postexe" :
					this.endBlocks.push(cmd[1]);
					break;
				case "nop" :
					break;
				case "reput" :
					break;
				default :
					throw "[mainLoop] Unknown opcode : " + cmd[0];
			}
			if (sf.sp < 0) {
				throw "stack size under zero in" + sf.lineNo;
			}
		}
	},
	
	/**
	 * Invoke the method
	 * @param {Object} recver
	 * @param {String} methodName
	 * @param {Array} args
	 * @param {HotRuby.StackFrame} sf
	 * @param {Number} type VM_CALL_ARGS_SPLAT_BIT, ...
	 * @param {boolean} invokeSuper
	 */
	invokeMethod : function(recver, methodName, args, sf, type, invokeSuper) {
		var recverClassName = this.getClassName(recver);
		var invokeClassName = recverClassName;
		var invokeMethodName = methodName;
		var func = null;

		// Invoke host method
		var done = this.invokeNative(recver, methodName, args, sf, recverClassName);
		if(done) return;
		
		if (invokeSuper) {
			var searchClass = this.classes[recverClassName];
			while (func == null) {
				// Search Parent class
				if (!("__parentClass" in searchClass)) break;
				searchClass = searchClass.__parentClass;
				invokeClassName = searchClass.__className;

				// Search method in class
				func = searchClass[methodName];
			}
		} else {
			// Search method in object
			//if (recver != null && recver.__methods != null) {
			if (recver != null && typeof(recver) == "object" && "__methods" in recver) {
				func = recver.__methods[methodName];
			}
			if (func == null) {
				//trace("recverClassName = " + recverClassName);
				var searchClass = this.classes[recverClassName];
				while (true) {
					//trace("methodName = " + methodName);
					// Search method in class
					func = searchClass[methodName];
					if (func != null) break;
					
					if (methodName == "new") {
						func = searchClass["initialize"];
						if (func != null) {
							invokeMethodName = "initialize";
							break;
						}
					}
	
					// Search Parent class
					if ("__parentClass" in searchClass) {
						searchClass = searchClass.__parentClass;
						//trace("searchClass = " + searchClass);
						if(searchClass == null) {
							func = null;
							break;
						}
						invokeClassName = searchClass.__className;
						//trace("invokeClassName = " + invokeClassName);
						continue;
					}
					break;
				}
			}
		}
		if (func == null) {
			if (invokeSuper) {
				sf.stack[sf.sp++] = null;
				return;
			}
			if (methodName != "new") {
				this.gotoLine(sf.lineNo);
				throw "NoMethodError in "+ sf.lineNo + ": undefined method `" + methodName + "' for " + recver + ":" + recverClassName
			}
		}
		
		if (methodName == "new") {
			// Create instance
			var newObj = {
				__className : recverClassName,
				__instanceVars : {}
			};
			sf.stack[sf.sp++] = newObj;
			if (func == null) return;

			recver = newObj;
		}

		// Splat array args
		if (type & HotRuby.VM_CALL_ARGS_SPLAT_BIT) {
			args = args.concat(args.pop().__native);
		}
		
		// Exec method
		switch (typeof(func)) {
			case "function" :
				sf.stack[sf.sp++] = func.call(this, recver, args, sf);
				break;
			case "object" :
				this.runOpcode(func, this.classes[invokeClassName],
						invokeMethodName, recver, args, sf, false, sf.cbaseObj);
				break;
			default :
				throw "[invokeMethod] Unknown function type : " + typeof(func);
		}
		
		// Returned value of initialize() is unnecessally at new()
		if (methodName == "new") {
			sf.sp--;
		}
	},
	
	/**
	 * Invoke native routine
	 */
	invokeNative: function(recver, methodName, args, sf, recverClassName) {
		switch(recverClassName) {
			case "NativeEnviornment":
				this.getNativeEnvVar(recver, methodName, args, sf);
				return true;
			case "NativeObject":
				this.invokeNativeMethod(recver, methodName, args, sf);
				return true;
			case "NativeClass":
				if(methodName == "new") {
					this.invokeNativeNew(recver, methodName, args, sf);
				} else {
					this.invokeNativeMethod(recver, methodName, args, sf);
				}
				return true;
			default:
				return false;
		}
	},
	
	/**
	 * Get variable from NativeEnviornment
	 */
	getNativeEnvVar: function(recver, varName, args, sf) {
		//trace(varName);
		if(this.env == "flash" && varName == "import") {
			var imp = args[0].__native;
			if(imp.charAt(imp.length - 1) != "*")
				throw "[getNativeEnvVar] Param must ends with * : " + imp;
			this.asPackages.push(imp.substr(0, imp.length - 1));
			sf.stack[sf.sp++] = this.nilObj;
			return;
		}
		
		if(varName in recver.__instanceVars) {
			sf.stack[sf.sp++] = recver.__instanceVars[varName];
			return;
		}
		
		if(this.env == "browser" || this.env == "rhino") {
			// Get native global variable
			var v = eval("(" + varName + ")");
			if(typeof(v) != "undefined") {
				if(typeof(v) == "function") {
					var convArgs = this.rubyObjectAryToNativeAry(args);
					var ret = v.apply(null, convArgs);
					sf.stack[sf.sp++] = this.nativeToRubyObject(ret);
				} else {
					sf.stack[sf.sp++] = {
						__className: "NativeObject",
						__native: v
					}
				}
				return;
			}
		} else if(this.env == "flash") {
			// Get NativeClass Object
			var classObj;
			if(varName in this.nativeClassObjCache) {
				classObj = this.nativeClassObjCache[varName];
			} else {
				for(var i=0; i<this.asPackages.length; i++) {
					try {
						classObj = getDefinitionByName(this.asPackages[i] + varName);
						break;
					} catch(e) {
					}
				}
				if(classObj == null) {
					throw "[getNativeEnvVar] Cannot find class: " + varName;
				}
				this.nativeClassObjCache[varName] = classObj;
			}
			sf.stack[sf.sp++] = {
				__className : "NativeClass",
				__native : classObj
			}
			return;
		}
		
		throw "[getNativeEnvVar] Cannot get the native variable: " + varName;
	},
	
	/**
	 * Invoke native method or get native instance variable
	 */
	invokeNativeMethod: function(recver, methodName, args, sf) {
		if (recver.__native == undefined) {
			throw "[invokeNativeMethod] __native is empty in " + sf.lineNo;
		}
		// Split methodName and operator
		var op = this.getOperator(methodName);
		if(op != null) {
			methodName = methodName.substr(0, methodName.length - op.length);
		}
		
		var ret;
		if(recver.__native[methodName] instanceof Function) {
			// Invoke native method
			if(op != null)
				throw "[invokeNativeMethod] Unsupported operator: " + op + " in " + sf.lineNo;
			var convArgs = this.rubyObjectAryToNativeAry(args);
			try {
				ret = recver.__native[methodName].apply(recver.__native, convArgs);
			} catch (e) {
				this.gotoLine(sf.lineNo);
				throw e + " in " + sf.lineNo;
				
			}
		} else {
			// Get native instance variable
			if(op == null) {
				ret = recver.__native[methodName];
			} else {
				switch(op) {
					case "=": 
						ret = recver.__native[methodName] = this.rubyObjectToNative(args[0]);
						break;
					default:
						throw "[invokeNativeMethod] Unsupported operator: " + op + " in " + sf.lineNo;
				}
			}
		}
		sf.stack[sf.sp++] = this.nativeToRubyObject(ret);
	},
	
	/**
	 * Convert ruby object to native value
	 * @param v ruby object
	 */
	rubyObjectToNative: function(v) {
		if(typeof(v) != "object") 
			return v;
		if(v.__className == "Proc") {
			var func = function() {
				var hr = arguments.callee.hr;
				var proc = arguments.callee.proc;
				hr.runOpcode(
					proc.__opcode, 
					proc.__parentStackFrame.classObj, 
					proc.__parentStackFrame.methodName, 
					proc.__parentStackFrame.self, 
					hr.nativeAryToRubyObjectAry(arguments),
					proc.__parentStackFrame,
					true);
			};
			func.hr = this;
			func.proc = v;
			return func;
		}
		return v.__native;
	},
	
	/**
	 * Convert array of ruby object to array of native object
	 * @param {Array} ary Array of ruby object
	 */
	rubyObjectAryToNativeAry: function(ary) {
		var convAry = new Array(ary.length);
		for(var i=0; i<ary.length; i++) {
			convAry[i] = this.rubyObjectToNative(ary[i]);
		}
		return convAry;
	},
	
	/**
	 * Convert native object to ruby object
	 * @param v native object
	 */
	nativeToRubyObject: function(v) {
		if(v === null) {
			return this.nilObj;
		}
		if(v === true) {
			return this.trueObj;
		}
		if(v === false) {
			return this.falseObj;
		}
		if(typeof(v) == "number") {
			return v;	
		}
		if(typeof(v) == "string") {
			return this.createRubyString(v);
		}
		if(typeof(v) == "object" && v instanceof Array) {
			return this.createRubyArray(v);
		}
		return {
			__className: "NativeObject",
			__native: v
		};
	},
	
	/**
	 * Convert array of native object to array of ruby object
	 * @param {Array} ary Array of native object
	 */
	nativeAryToRubyObjectAry: function(ary) {
		var convAry = new Array(ary.length);
		for(var i=0; i<ary.length; i++) {
			convAry[i] = this.nativeToRubyObject(ary[i]);
		}
		return convAry;
	},
	
	/**
	 * Invoke native "new", and create native instance.
	 */
	invokeNativeNew: function(recver, methodName, args, sf) {
		var obj;
		var args = this.rubyObjectAryToNativeAry(args);
		switch(args.length) {
			case 0: obj = new recver.__native(); break; 
			case 1: obj = new recver.__native(args[0]); break; 
			case 2: obj = new recver.__native(args[0], args[1]); break; 
			case 3: obj = new recver.__native(args[0], args[1], args[2]); break; 
			case 4: obj = new recver.__native(args[0], args[1], args[2], args[3]); break; 
			case 5: obj = new recver.__native(args[0], args[1], args[2], args[3], args[4]); break; 
			case 6: obj = new recver.__native(args[0], args[1], args[2], args[3], args[4], args[5]); break;
			case 7: obj = new recver.__native(args[0], args[1], args[2], args[3], args[4], args[5], args[6]); break;
			case 8: obj = new recver.__native(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]); break;
			case 9: obj = new recver.__native(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]); break;
			default: throw "[invokeNativeNew] Too much arguments: " + args.length;
		}
		sf.stack[sf.sp++] = {
			__className : "NativeObject",
			__native : obj
		};
	},
	
	/**
	 * Set the Constant
	 * @param {HotRuby.StackFrame} sf
	 * @param {Object} classObj
	 * @param {String} constName
	 * @param constValue
	 * @private
	 */
	setConstant : function(sf, classObj, constName, constValue) {
		if (classObj == null || classObj == this.nilObj) {
			classObj = sf.classObj;
		} else if (classObj == false || classObj == this.falseObj) {
			// TODO
			throw "[setConstant] Not implemented";
		}
		classObj.__constantVars[constName] = constValue;
	},
	
	/**
	 * Get the constant
	 * @param {HotRuby.StackFrame} sf
	 * @param {Object} classObj
	 * @param {String} constName
	 * @return constant value
	 * @private
	 */
	getConstant : function(sf, classObj, constName) {
		if (classObj == null || classObj == this.nilObj) {
			var isFound = false;
			// Search outer(parentStackFrame)
			for (var checkSF = sf;!isFound; checkSF = checkSF.parentStackFrame) {
				if (checkSF == this.topSF) {
					break;
				}
				if (constName in checkSF.classObj.__constantVars) {
					classObj = checkSF.classObj;
					isFound = true;
				}
			}
			// Search parent class
			if (!isFound) {
				for (classObj = sf.classObj;classObj != this.classes.Object;) {
					if (constName in classObj.__constantVars) {
						isFound = true;
						break;
					}
					classObj = classObj.__parentClass;
				}
			}
			// Search in Object class
			if (!isFound) {
				classObj = this.classes.Object;
			}
		} else if (classObj == false || classObj == this.falseObj) {
			// TODO
			throw "[setConstant] Not implemented";
		}
		if (classObj == null || classObj == this.nilObj)
			throw "[getConstant] Cannot find constant : " + constName;
		return classObj.__constantVars[constName];
	},
	
	/**
	 * Returns class name from object.
	 * @param obj
	 * @return {String}
	 */
	getClassName : function(obj) {
		if (obj == null)
			return "Object";
		switch (typeof(obj)) {
			case "object" :
				return obj.__className;
			case "number" :
				return "Float";
			default :
				throw "[getClassName] unknown type : " + typeof(obj);
		}
	},
	
	/**
	 * JavaScript String -> Ruby String
	 * @param {String} str
	 * @return {String}
	 */
	createRubyString : function(str) {
		return {
			__native : str,
			__className : "String"
		};
	},
	
	/**
	 * opcode -> Ruby Proc
	 * @param {Array} opcode
	 * @param {HotRuby.StackFrame} sf
	 * @return {Object} Proc
	 */
	createRubyProc : function(opcode, sf) {
		return {
			__opcode : opcode,
			__className : "Proc",
			__parentStackFrame : sf
		};
	},
	
	/**
	 * opcode -> Ruby Proc
	 * @param {Array} opcode
	 * @param {HotRuby.StackFrame} sf
	 * @return {Object} Proc
	 */
	/* // Ruby 1.9.2 対応：保留
	createRubyISeq : function(opcode, sf) {
		return {
			__opcode : opcode,
			__className : "Iseq",
			__parentStackFrame : sf
		};
	},
	*/
		
	/**
	 * JavaScript Array -> Ruby Array
	 * @param {Array} ary
	 * @return {Array}
	 */
	createRubyArray : function(ary) {
		return {
			__native : ary,
			__className : "Array"
		};
	},
	
	/**
	 * JavaScript Array -> Ruby Hash
	 * @param {Array} ary
	 * @return {Object}
	 */
	createRubyHash : function(ary) {
		var hash = {
			__className : "Hash",
			__instanceVars : {
				length : ary.length / 2
			},
			__native : {}
		};
		for (var i = 0;i < ary.length; i += 2) {
			if(typeof(ary[i]) == "object" && ary[i].__className == "String") {
				hash.__native[ary[i].__native] = ary[i + 1];
			} else {
				throw "[createRubyHash] Unsupported. Cannot put this object to Hash";
			}
		}
		return hash;
	},
	
	/**
	 * Creates Ruby Range
	 * @param {Number} last
	 * @param {Number} first
	 * @param {boolean} exclude_end
	 */
	createRubyRange : function(last, first, exclude_end) {
		return {
			__className : "Range",
			__instanceVars : {
				first : first,
				last : last,
				exclude_end : exclude_end ? this.trueObj : this.falseObj
			}
		};
	},
	
	/**
	 * Print to debug dom.
	 * @param {String} str
	 */
	printDebug : function(str) {
		switch(this.env) {
			case "browser":
				var div = document.createElement("div");
				var text = document.createTextNode(str);
				div.appendChild(text);
				this.debugDom.appendChild(div);
				break;
			case "flash":
	            HotRuby.debugTextField.text += str + "\n";
				break;
			case "rhino":
				print(str);
				break;
		}
	},

	/**
	 * Search <script type="text/ruby"></script> and run.
	 * @param {String} url Ruby compiler url
	 */
	runFromScriptTag : function(url) {
		var ary = document.getElementsByTagName("script");
		for(var i=0; i < ary.length; i++) {
			var hoge = ary[i].type;
			if(ary[i].type == "text/ruby") {
				this.compileAndRun(url, ary[i].text, true);
				break;
			}
		}
	},
	
	/**
	 * Get the library from server.
	 * @param {lib} A library page
	 */
	compileAndRun : function(url, src, async) {
		var html = $.ajax({
			url : url,
			data : { src: encodeURIComponent(src) },
			type : "POST",
    		async : async, 
			success : function(response){
				if(response.length == 0) {
					alert("no bytecode.");
				} else {
					response = response.replace(/\+/g, " ");
					var opcode_text = unescape(response);
					var opcode = eval("(" + opcode_text + ")");
					$("#opcode").text(opcode_text);
					if (opcode.length > 0) {
						hotruby.run(opcode);
					} else {
						opcode[0].match(/\w+:(\d+):/);
						hotruby.gotoLine(RegExp.$1);
						hotruby.printDebug(opcode[0]);
					}
				}
			},
			error: function(response){
				alert("Compile failed");
			}
		});
	},
	
	/**
	 * Get the library from server.
	 * @param {lib} A library page
	 */
	require : function(lib) {
		if (this.loaded_feature.lib == undefined) {
			var lib = encodeURIComponent(lib);
			this.loaded_feature.lib = lib;
			//this.compileAndRun(url, src, true);
			var html = $.ajax({
			    url : "/require/" + lib,
    			async : false, // ←デフォルトはtrue（非同期）
				success : function(response){
					if (response.length == 0) {
						alert("require no data.");
					}
					else {
						response = response.replace(/\+/g, " ");
						var opcode = eval("(" + unescape(response) + ")");
						if (opcode.length > 0) {
							hotruby.run(opcode);
						} else {
						}
					}
				},
				failure: function(response){
					alert("require failed");
				}
			});
		}
	},
	
	/**
	 * Check whether the environment is Flash, Browser or Rhino.
	 */
	checkEnv : function() {
		if(typeof(_root) != "undefined") {
			this.env = "flash";
			// Create debug text field
            HotRuby.debugTextField = new TextField();
            HotRuby.debugTextField.autoSize = TextFieldAutoSize.LEFT;
            _root.addChild(HotRuby.debugTextField);
            // Define alert
			alert = function(str) {
				HotRuby.debugTextField.text += str + "\n";
			}
			this.nativeClassObjCache = {};
			this.asPackages = [""];
			// Create _root NativeObject
			this.globalVars.$native.__instanceVars._root = {
				__className : "NativeObject",
				__native : _root
			}
		} else if(typeof(alert) == "undefined") {
			this.env = "rhino";
            // Define alert
			alert = function(str) {
				print(str);
			}
		} else {
			this.env = "browser";
			// Get debug DOM
			this.debugDom = document.getElementById("debug");
			if (this.debugDom == null) {
				this.debugDom = document.body;
			}
		}
	},
	
	getOperator: function(str) {
		var result = str.match(/[^\+\-\*\/%=]+([\+\-\*\/%]?=)/);
		if(result == null || result == false) {
			return null;
		}
		if(result instanceof Array) {
			return result[1];
		} else {
			RegExp.$1;
		}
	}, 
	
	//// エディタの特定行にジャンプ。
	gotoLine: function(lineNo) {
		if (typeof(editAreaLoader) != 'undefined') {
			editAreaLoader.execCommand("ruby_src", "go_to_line", "" + lineNo);
		}
	},

	//// 整数decをn進数の文字列に変換。	
    dec2numeral: function(dec, n){
		var bin = "";
        do {
            bin = "0123456789abcdefghijklmnopqrstuvwxyz".slice(dec % n, 1) + bin;
            dec = Math.floor(dec/n);
        } while (dec > 0);
        return bin;
    },
};

// Consts
/** @memberof HotRuby */
HotRuby.VM_CALL_ARGS_SPLAT_BIT = 2;
/** @memberof HotRuby */
HotRuby.VM_CALL_ARGS_BLOCKARG_BIT = 4;
/** @memberof HotRuby */
HotRuby.VM_CALL_FCALL_BIT = 8;
/** @memberof HotRuby */
HotRuby.VM_CALL_VCALL_BIT = 16;

// The license of this source is "Ruby License"
HotRuby.prototype.classes = {
	"Object" : {
		"==" : function(recver, args) {
			return recver == args[0] ? this.trueObj : this.falseObj;	
		},
		
		"to_s" : function(recver) {
			if (typeof(recver) == "number")
				return this.createRubyString(recver.toString());
			else
				return this.createRubyString(recver.__native.toString());
		},
		
		"to_str" : function(recver) {
			if (typeof(recver) == "number")
				return this.createRubyString(recver.toString());
			else
				return this.createRubyString("<" + recver.__className + ":" + recver.__native + ">");
		},
		
		"puts" : function(recver, args, sf) {
			if(args.length == 0) {
				this.printDebug("");
				return;
			}
			for(var i=0; i<args.length; i++) {
				var obj = args[i];
				if(obj == null || obj == this.nilObj) {
					this.printDebug("nil");
					continue;
				}
				if(obj == this.trueObj) {
					this.printDebug("true");
					continue;
				}
				if(obj == this.falseObj) {
					this.printDebug("false");
					continue;
				}
				if(typeof(obj) == "number") {
					this.printDebug(obj);
					continue;
				}
				if(obj.__className == "String") {
					this.printDebug(obj.__native);
					continue;
				}
				if(obj.__className == "Array") {
					for(var j=0; j<obj.__native.length; j++) {
						this.printDebug(obj.__native[j]);
					}
					continue;
				}
				if (obj.__className == "Hash") {
					for(var j=0 in obj.__native) {
						this.printDebug(j);
					}
					continue;
				}
				if (obj.__className == "NativeObject") {
					if (typeof(obj.__native) == "Array") {
						for(var j=0; j<obj.__native.length; j++) {
							this.printDebug(obj.__native[j]);
						}
					} else {
						this.printDebug("<" + obj.__className + ":" + obj.__native + ">");
					}
					continue;
				}
				
				var origSP = sf.sp;
				try {
					this.invokeMethod(obj, "to_ary", [], sf, 0, false);
					obj = sf.stack[--sf.sp];
					for(var j=0; j<obj.__native.length; j++) {
						this.printDebug(obj.__native[j]);
					}
					continue;
				} catch(e) {
				}
				sf.sp = origSP;

				this.invokeMethod(obj, "to_s", [], sf, 0, false);
				obj = sf.stack[--sf.sp];
				this.printDebug(obj.__native);
			}
		},
		
		"add_event_listener" : function(recver, args, sf) {
			var event = args[0];
			var proc = args[1];
			document.addEventListener(event.__native, 
				function(event) {
					var ruby_event = hotruby.nativeToRubyObject(event);
					hotruby.invokeMethod(proc, "yield", [ruby_event], sf, 0, false);
					sf.sp--;
				},
		 		false);
		},
		
		"class": function(recver) {
			return this.createRubyString(recver.__className);
		},
		
		"require": function(recver, args) {
			var lib = args[0];
			this.require(lib.__native);	
		},
		
		"sprintf": function(recver, args){
			var str = va_sprintf(args);
			return this.createRubyString(str);
		},

		"printf": function(recver, args){
			var str = va_sprintf(args);
			this.printDebug(str);
			return this.createRubyString(str);
		},
		
		"rand": function(recver, args) {
			var r = Math.random();
			if (args.length != 0) {
				r = Math.floor(r*args[0]);
			}
			return r;
		},
		
		"breakpoint" : function() {
			var error     = new Error();
			error.name    = "BreakPointError";
			error.message = "BreakPoint.";
			throw error;  
		},
				
		"set_timeout" : function(recver, args, sf) {
			var timeout = args[0];
			var proc = args[1];
			return setTimeout(
				function() {
					hotruby.invokeMethod(proc, "yield", [], sf, 0, false);	
					sf.sp--;
				},
				timeout);
		},

		
		/* // Ruby 1.9.2 対応：保留
		"core#define_method": function(recver, args, sf){
			var n = args[0];
			var iseq = sf.stack[sf.sp--].__opcode;
			var method = sf.stack[sf.sp--].__native;
			var obj = sf.stack[sf.sp--];
			//if (sf.cbaseObj != null) 
			//	obj = sf.cbaseObj;
			//if (obj == null || obj == this.nilObj) {
			//	sf.classObj[method] = iseq;
			//} else {
				if (!("__methods" in obj)) 
					obj.__methods = {};
				obj.__methods[method] = iseq;
			//}
		}
		*/

	},

	"TrueClass" : {
		"&" : function(recver, args) {
			return args[0] ? true : false;
		},
		
		"|" : function(recver, args) {
			return true;
		},

		"^" : function(recver, args) {
			return args[0] ? false : true;
		},
		
		"to_str" : function() {
			return this.createRubyString("true");
		}
	},

	"FalseClass" : {
		"&" : function(recver, args) {
			return false;
		},
		
		"|" : function(recver, args) {
			return args[0] ? true : false;
		},

		"^" : function(recver, args) {
			return args[0] ? true : false;
		},
		
		"to_str" : function() {
			return this.createRubyString("false");
		}

	},

	"NilClass" : {
		"to_str" : function() {
			return this.createRubyString("");
		}

	},

	"NativeEnviornment" : {
	},
	"NativeObject" : {
	},
	"NativeClass" : {
	},
	
	"Proc" : {
		"initialize" : function(recver, args) {
			recver.__opcode = args[0].__opcode;
			recver.__parentStackFrame = args[0].__parentStackFrame;
		},
		
		"yield" : function(recver, args, sf) {
			this.runOpcode(
				recver.__opcode, 
				recver.__parentStackFrame.classObj, 
				recver.__parentStackFrame.methodName, 
				recver.__parentStackFrame.self, 
				args, 
				recver.__parentStackFrame,
				true);
			return sf.stack[--sf.sp];
		}
	},

	"Float" : {
		"+" : function(recver, args) {
			return recver + args[0];
		},

		"-" : function(recver, args) {
			return recver - args[0];
		},

		"*" : function(recver, args) {
			return recver * args[0];
		},

		"/" : function(recver, args) {
			return recver / args[0];
		},
		
		"%" : function(recver, args) {
			return recver % args[0];
		},
		
		"<=>" : function(recver, args) {
			if(recver > args[0])
				return 1;
			else if(recver == args[0])
				return 0;
			if(recver < args[0])
				return -1;
		},
		
		"<" : function(recver, args) {
			return recver < args[0] ? this.trueObj :  this.falseObj;
		},

		">" : function(recver, args) {
			return recver > args[0] ? this.trueObj :  this.falseObj;
		},
		
		"<=" : function(recver, args) {
			return recver <= args[0] ? this.trueObj :  this.falseObj;
		},

		">=" : function(recver, args) {
			return recver >= args[0] ? this.trueObj :  this.falseObj;
		},
		
		"==" : function(recver, args) {
			return recver == args[0] ? this.trueObj :  this.falseObj;
		},
		
		"-@" : function(recver, args) {
			return -recver;	
		},
		
		"to_i" : function(recver) {
			return Math.floor(recver);	
		},
		
		"class": function(recver) {
			return this.createRubyString("Float");
		},

		"**" : function(recver, args) {
			return Math.pow(recver, args[0]);
		},
		
		"round" : function(recver) {
			return Math.round(recver);
		},

		"abs" : function(recver) {
			return Math.abs(recver)
		},

		// 以下、いつかちゃんとIntegerに移したいメソッドw
		"times" : function(recver, args, sf) {
			var proc = args[0];
			proc.__parentStackFrame = sf;
			for (var i = 0; i < recver; i++) {
				this.invokeMethod(proc, "yield", [i], sf, 0, false);
				sf.sp--;
			}
		},
		
		"step": function(recver, args, sf) {
			var finish = args[0];
			var proc = args[args.length - 1];
			proc.__parentStackFrame = sf;
			var step = 1;
			if (args.length == 3) {
				step = args[1];
			}
			for (var i = recver; i <= finish; i += step) {
				this.invokeMethod(proc, "yield", [i], sf, 0, false);
				sf.sp--;
			}
		},
		
		"<<": function(recver, args){
			return recver << args[0];
		},
		
		">>": function(recver, args){
			return recver >> args[0];
		},
		
		"upto": function(recver, args, sf) {
			var proc = args[1];
			proc.__parentStackFrame = sf;
			for (var i = recver; i <= args[0]; i++) {
				this.invokeMethod(proc, "yield", [i], sf, 0, false);
				sf.sp--;
			}
		},

		"to_s" : function(recver, args) {
			if (args.length == 0) {
				return this.createRubyString(recver.toString());
			} else {
				// Integer.to_s(x) を模倣
				var n = args[0];
				var val = Math.floor(recver);
				var str = this.dec2numeral(val, n);
				return this.createRubyString(str);
			}	
		},

	},

	"Integer" : {
		"+" : function(recver, args) {
			return recver + args[0];
		},

		"-" : function(recver, args) {
			return recver - args[0];
		},

		"*" : function(recver, args) {
			return recver * args[0];
		},

		"/" : function(recver, args) {
			return Math.floor(recver / args[0]);
		},
		
		"%" : function(recver, args) {
			return recver % args[0];
		},
		
		"<=>" : function(recver, args) {
			if(recver > args[0])
				return 1;
			else if(recver == args[0])
				return 0;
			if(recver < args[0])
				return -1;
		},
		
		"<" : function(recver, args) {
			return recver < args[0] ? this.trueObj :  this.falseObj;
		},

		">" : function(recver, args) {
			return recver > args[0] ? this.trueObj :  this.falseObj;
		},
		
		"<=" : function(recver, args) {
			return recver <= args[0] ? this.trueObj :  this.falseObj;
		},

		">=" : function(recver, args) {
			return recver >= args[0] ? this.trueObj :  this.falseObj;
		},
		
		"==" : function(recver, args) {
			return recver == args[0] ? this.trueObj :  this.falseObj;
		},
		
		"<<": function(recver, args){
			return recver << args[0];
		},
		
		"-@" : function(recver, args) {
			return -recver;	
		}	

	},

	"String" : {
		"+" : function(recver, args) {
			if(typeof(args[0]) == "object")
				return this.createRubyString(recver.__native + args[0].__native);
			else
				return this.createRubyString(recver.__native + args[0]);
		},

		"<<" : function(recver, args) {
			recver.__native += args[0].__native;
			return recver;
		},
				
		"*" : function(recver, args) {
			var ary = new Array(args[0]);
			for(var i=0; i<args[0]; i++) {
				ary[i] = recver.__native;
			}
			return this.createRubyString(ary.join(""));
		},
		
		"==" : function(recver, args) {
			return recver.__native == args[0].__native ? this.trueObj : this.falseObj;
		},
		
		"[]" : function(recver, args) {
			if(args.length == 1 && typeof(args[0]) == "number") {
				var no = args[0];
				if(no < 0) 
					no = recver.__native.length + no;
				if(no < 0 || no > recver.__native.length)
					return this.nilObj;
				return this.createRubyString(recver.__native.charAt(no));
			} else if (args.length == 2 && typeof(args[0]) == "number" && typeof(args[1]) == "number") {
				var start = args[0];
				var length = args[1];
				if (length < 0) {
					return this.nilObj;
				} 
				if (start < 0) {
					start = recver.__native.length + start;
				}
				var end = start + length;
				if (start + length >= recver.__native.length) {
					length = recver.__native.length - start;
				}
				return this.createRubyString(recver.__native.substr(start, length));
			} else {
				throw "Unsupported String[]";
			}
		},
		
		"length" : function(recver) {
			return recver.__native.length;
		},
		
		"size" : function(recver) {
			return recver.__native.length;
		},
		
		"to_str" : function(recver) {
			return recver;
		},
		
		"to_f" : function(recver) {
			return parseFloat(recver.__native);
		},

		"to_i" : function(recver) {
			return parseInt(recver.__native);
		},

	},
	
	"Array" : {
		"length" : function(recver) {
			return recver.__native.length;
		},
		
		"size" : function(recver) {
			return recver.__native.length;
		},
		
		"[]" : function(recver, args) {
			return recver.__native[args[0]];
		},
		
		"first" : function(recver, args) {
			return recver.__native[0];
		},
		
		"last" : function(recver, args) {
			return recver.__native[-1];
		},
		
		"[]=" : function(recver, args) {
			recver.__native[args[0]] = args[1];
		},
		
		"join" : function(recver, args) {
			return this.createRubyString(recver.__native.join(args[0]));
		},
		
		"to_s" : function(recver, args) {
			return this.createRubyString(recver.__native.join(args[0]));
		},
		
		"<<" : function(recver, args) {
			return recver.__native.push(args[0]);
		},

		"+" : function(recver, args) {
			return this.createRubyArray(recver.__native.concat(args[0].__native));
		},

		"each" : function(recver, args, sf) {
			for (var i = 0;i < recver.__native.length; i++) {
				var obj = recver.__native[i];
				this.invokeMethod(args[0], "yield", [obj], sf, 0, false);
				sf.sp--;
			}
		},
		
		"shift" : function(recver) {
			return recver.__native.shift();
		},
		
		"sample" : function(recver) {
			var n = Math.floor(Math.random()*recver.__native.length);
			return recver.__native[n];
		},
		
		"-" : function(recver, args) {
			var other = args[0].__native;
			var index;
			var result = jQuery.grep(recver.__native, function(val, i) {
				var r = jQuery.inArray(val, other);
				return r == -1;
			});
			return this.createRubyArray(result);
		},
		
		"inject" : function(recver, args, sf) {
			var result = args[0]; // TODO: 引数を省略するとself.first
			for (var i = 0; i < recver.__native.length; i++) {
				var obj = recver.__native[i];
				this.invokeMethod(args[1], "yield", [result, obj], sf, 0, false);
				result = sf.stack[sf.sp--];
			}
			switch (typeof(result)) {
				case "number":
					break;
				case "string":
					result = this.createRubyString(result);
					break;
				default:
					this.printDebug("inject is not supported "+ typeof(result));
					break;			
			}
			return result;
		}
		
	},
	
	"Hash" : {
		"[]" : function(recver, args) {
			var val = recver.__native[args[0].__native];
			if (val == undefined) {
				val = this.nilObj;
			}
			return val;
		},
		
		"[]=" : function(recver, args) {
			if(!(args[0].__native in recver.__native)) {
				recver.__instanceVars.length++;
			}
			return (recver.__native[args[0].__native] = args[1]);
		},
		
		"length" : function(recver) {
			return recver.__instanceVars.length;
		},
		
		"size" : function(recver) {
			return recver.__instanceVars.length++;
		},
		
		"each" : function(recver, args, sf) {
			var k;
			for (k in recver.__native) {
				var value = recver.__native[k];
				var key = this.createRubyString(k);
				this.invokeMethod(args[0], "yield", [key, value], sf, 0, false);
				sf.sp--;
			}
		},
		

	},
	
	"Range" : {
		"each" : function(recver, args, sf) {
			if(recver.__instanceVars.exclude_end == this.trueObj) {
				for (var i = recver.__instanceVars.first;i < recver.__instanceVars.last; i++) {
					this.invokeMethod(args[0], "yield", [i], sf, 0, false);
					sf.sp--;
				}
			} else {
				for (var i = recver.__instanceVars.first;i <= recver.__instanceVars.last; i++) {
					this.invokeMethod(args[0], "yield", [i], sf, 0, false);
					sf.sp--;
				}
			}
		},
		
		"begin" : function(recver) {
			return recver.__instanceVars.first;
		},
		
		"first" : function(recver) {
			return recver.__instanceVars.first;
		},
		
		"end" : function(recver) {
			return recver.__instanceVars.last;
		},
		
		"last" : function(recver) {
			return recver.__instanceVars.last;
		},
		
		"exclude_end?" : function(recver) {
			return recver.__instanceVars.exclude_end;
		},
		
		"length" : function(recver) {
			with(recver.__instanceVars) {
				return (last - first + (exclude_end == this.trueObj ? 0 : 1));
			}
		},
		
		"size" : function(recver) {
			with(recver.__instanceVars) {
				return (last - first + (exclude_end == this.trueObj ? 0 : 1));
			}
		},
		
		"step" : function(recver, args, sf) {
			var step;
			var proc;
			if(args.length == 1) { 
				step = 1;
				proc = args[0];
			} else {
				step = args[0];
				proc = args[1];
			}
			
			if(recver.__instanceVars.exclude_end == this.trueObj) {
				for (var i = recver.__instanceVars.first;i < recver.__instanceVars.last; i += step) {
					this.invokeMethod(proc, "yield", [i], sf, 0, false);
					sf.sp--;
				}
			} else {
				for (var i = recver.__instanceVars.first;i <= recver.__instanceVars.last; i += step) {
					this.invokeMethod(proc, "yield", [i], sf, 0, false);
					sf.sp--;
				}
			}
		},
		
		"inject" : function(recver, args, sf) {
			var result = args[0]; // TODO: 引数を省略するとself.first
			for (var i = 0; i < recver.__native.length; i++) {
				var obj = recver.__native[i];
				this.invokeMethod(args[1], "yield", [result, obj], sf, 0, false);
				result = sf.stack[sf.sp--];
			}
			switch (typeof(result)) {
				case "number":
					break;
				case "string":
					result = this.createRubyString(result);
					break;
				default:
					this.printDebug("inject is not supported "+ typeof(result));
					break;			
			}
			return result;
		}
	},
	
	"Time" : {
		"initialize" : function(recver, args) {
			recver.__instanceVars.date = new Date(); 
		},
		
		"to_s" : function(recver) {
			return this.createRubyString(recver.__instanceVars.date.toString());
		},
		
		"to_f" : function(recver) {
			return recver.__instanceVars.date.getTime() / 1000;
		}, 
		
		"-" : function(recver, args) {
			var other = args[0];
			return (recver.__instanceVars.date.getTime() - other.__instanceVars.date.getTime())/1000;
		}
	}, 
	
	"Interval" : {
		"initialize" : function(recver, args) {
			recver.__instanceVars.step = args[0];
			recver.__instanceVars.proc = args[1];
		},
		
		"start" : function(recver, args, sf) {
			var step = recver.__instanceVars.step;
			recver.__instanceVars.timerid = setInterval(
				function() {
					var proc = recver.__instanceVars.proc;
					hotruby.invokeMethod(proc, "yield", [], sf, 0, false);	
					sf.sp--;
				},
				step);
		},
					
		"stop" : function(recver) {
			clearInterval(recver.__instanceVars.timerid);
		}
	}, 
	
	"Math" : {
		"sin" : function(recver, args) {
			return Math.sin(args[0]);
		}, 
		"cos" : function(recver, args) {
			return Math.cos(args[0]);
		}, 
		"tan" : function(recver, args) {
			return Math.tan(args[0]);
		}, 
		"asin" : function(recver, args) {
			return Math.asin(args[0]);
		}, 
		"acos" : function(recver, args) {
			return Math.acos(args[0]);
		}, 
		"atan" : function(recver, args) {
			return Math.atan(args[0]);
		}, 
		"atan2" : function(recver, args) {
			return Math.atan2(args[0]);
		}, 
		"log" : function(recver, args) {
			return Math.log(args[0]);
		}, 
		"exp" : function(recver, args) {
			return Math.exp(args[0]);
		}, 
		"sqrt" : function(recver, args) {
			return Math.sqrt(args[0]);
		}, 
		"PI": function(recver){
			return Math.PI;
		},
	}
};

(function() {
	var classes = HotRuby.prototype.classes;
	for (var className in classes) {
		classes[className].__className = className;
		classes[className].__parentClass = classes.Object;
		if(!("__constantVars" in classes[className]))
			classes[className].__constantVars = {};
		if(!("__classVars" in classes[className]))
			classes[className].__classVars = {};
	}
	classes.Object.__parentClass = null;
	
	for (var className in classes) {
		classes.Object.__constantVars[className] = classes[className];
	}
})();
