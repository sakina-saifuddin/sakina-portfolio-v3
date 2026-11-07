import {Basic} from "../../web/basic.js";
let buf="";
const b=new Basic({write:s=>buf+=s});
const run=(lines,inputs=[])=>{buf="";b.setProgram(lines.map(l=>{const m=/^(\d+)\s?(.*)$/.exec(l);return [+m[1],m[2]]}));b.run();
 let g=0;while((b.state==="running"||b.state==="input")&&g++<1000){b.step(1000);if(b.state==="input"){b.provide(inputs.shift()??"")}}
 return buf+"|"+b.state};
const t=(name,got,want)=>{const ok=got===want;console.log(ok?"PASS":"FAIL",name,ok?"":"\n got:"+JSON.stringify(got)+"\n want:"+JSON.stringify(want))};
t("squares",run(['10 FOR I = 1 TO 3','20 PRINT I; "sq"; I*I','30 NEXT I']),' 1 sq 1 \n 2 sq 4 \n 3 sq 9 \n|done');
t("hello",run(['10 INPUT "Name"; N$','20 PRINT "Hi, "; N$; "!"'],["Sakina"]),'Name? Hi, Sakina!\n|done');
t("gosub/if/else",run(['10 X=5','20 IF X>3 THEN PRINT "big" ELSE PRINT "small"','30 IF X>9 THEN PRINT "huge" ELSE PRINT "tiny"','40 GOSUB 100','50 END','100 PRINT "sub"','110 RETURN']),'big\ntiny\nsub\n|done');
t("while",run(['10 I=0','20 WHILE I<3','30 I=I+1','40 PRINT I;','50 WEND','60 PRINT "end"']),' 1  2  3 end\n|done');
t("data",run(['10 READ A$, B','20 PRINT A$; B','30 DATA hello, 42']),'hello 42 \n|done');
t("nested for",run(['10 FOR I=1 TO 2:FOR J=1 TO 2:PRINT I*J;:NEXT J:NEXT I']),' 1  2  2  4 |done');
t("empty for",run(['10 FOR I=5 TO 1','20 PRINT "no"','30 NEXT','40 PRINT "ok"']),' ok\n|done'.trim()==' ok\n|done'?'ok\n|done':'ok\n|done');
t("err",run(['10 PRINT 1/0']),'Division by zero in 10\n|error');
t("syntax",run(['10 PRINT )']),'Syntax error in 10\n|error');
t("undefined line",run(['10 GOTO 99']),'Undefined line 99 in 10\n|error');
t("redo",run(['10 INPUT A','20 PRINT A'],["x","7"]),'? ?Redo from start\n? ' + ' 7 \n|done');
t("string funcs",run(['10 PRINT LEFT$("abcdef",3); MID$("abcdef",2,2); LEN("xy"); UCASE$("q")']),'abcdef'.slice(0,3)+'bc 2 Q\n|done');
t("array",run(['10 DIM A(3)','20 FOR I=0 TO 3:A(I)=I*2:NEXT','30 PRINT A(2)+A(3)']),' 10 \n|done');
t("print question",run(['10 ? 2+3']),' 5 \n|done');
buf="";let m=b.direct("PRINT 2+2");console.log("direct",JSON.stringify(buf),m);
buf="";m=b.direct("A=5");buf="";m=b.direct("PRINT A*2");console.log("vars persist",JSON.stringify(buf),m);
m=b.direct("HELLO");console.log("unknown",m);
buf="";m=b.direct("FOR I=1 TO 3:PRINT I;:NEXT");console.log("direct for",JSON.stringify(buf),m);
// guess-like loop with IF..THEN stmt : GOTO
buf="";console.log(run(['10 N=7','20 INPUT G','30 IF G<N THEN PRINT "low": GOTO 20','40 IF G>N THEN PRINT "high": GOTO 20','50 PRINT "yes"'],["3","9","7"]));
