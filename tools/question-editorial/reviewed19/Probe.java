import java.util.*;
import java.nio.file.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

class Probe {
    static int calls;
    static int f(int n) { calls++; return n==0 ? 1 : n*f(n-1); }
    public static void main(String[] args) throws Exception {
        int count=0;
        for (int i=0; i<9; ++i) count++;
        System.out.println(count);
        List<Integer> seq=new ArrayList<>();
        for (int indice=1, sel=2, elec=3; indice<20; indice=(indice+sel)*elec) { seq.add(indice); sel++; }
        System.out.println(seq);
        seq.clear();
        for(int i=10, j=1; i>0; i=i-j) { seq.add(i); j++; }
        System.out.println(seq);
        int i=0, r=0;
        while(i<3) {
            switch(i) {
                case 0:r=i;break; case 1:r=i+1;break; case 2:r=i+2;case 3:r=i+3;
            }
            i++;
        }
        System.out.println(r);
        Path src=Path.of(args[0], "BooleanProbe.java");
        Files.writeString(src, "class BooleanProbe {boolean x=true,y=false;}");
        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        try(var files=compiler.getStandardFileManager(null,null,null)) {
            var task=(JavacTask)compiler.getTask(null,files,null,List.of("-proc:none"),null,files.getJavaFileObjects(src.toFile()));
            for(var tree:task.parse()) new TreeScanner<Void,Void>() {
                @Override public Void visitLiteral(LiteralTree t,Void unused) { System.out.println(t.getKind()); return null; }
            }.scan(tree,null);
        }
        if(f(4)!=24) throw new AssertionError();
        System.out.println(calls);
    }
}
