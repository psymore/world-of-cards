#nullable enable
#r "nuget: Microsoft.CodeAnalysis.CSharp, 4.9.2"

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// ── Args (dotnet-script uses capital Args) ───────────────────────────────────
var repoRoot   = Args.Count > 0 ? Args[0] : ".";
var outputFile = Args.Count > 1 ? Args[1] : "ctags_raw.json";

// ── Collect files ─────────────────────────────────────────────────────────────
var csFiles = Directory
    .GetFiles(repoRoot, "*.cs", SearchOption.AllDirectories)
    .Where(f => !f.Contains(Path.DirectorySeparatorChar + "obj" + Path.DirectorySeparatorChar)
             && !f.Contains(Path.DirectorySeparatorChar + "bin" + Path.DirectorySeparatorChar))
    .OrderBy(f => f)
    .ToList();

Console.Error.WriteLine($"[extract] {csFiles.Count} .cs files found (obj/bin excluded)");

// ── Output ────────────────────────────────────────────────────────────────────
var writer = new StreamWriter(outputFile, append: false, System.Text.Encoding.UTF8);
int symbolCount = 0;

void Emit(string name, string kind, string? scope, string? ns,
          string? signature, string? access, string file, int line)
{
    var obj = new Dictionary<string, object?>
    {
        ["name"]      = name,
        ["kind"]      = kind,
        ["scope"]     = scope,
        ["namespace"] = ns,
        ["signature"] = signature,
        ["access"]    = access,
        ["path"]      = file,
        ["line"]      = line
    };
    writer.WriteLine(JsonSerializer.Serialize(obj));
    symbolCount++;
}

// ── Process files ─────────────────────────────────────────────────────────────
foreach (var filePath in csFiles)
{
    string code;
    try { code = File.ReadAllText(filePath); }
    catch (Exception ex) { Console.Error.WriteLine($"[SKIP] {filePath}: {ex.Message}"); continue; }

    var tree = CSharpSyntaxTree.ParseText(code, path: filePath);
    var root = tree.GetRoot();
    var rel  = Path.GetRelativePath(repoRoot, filePath).Replace('\\', '/');

    foreach (var node in root.DescendantNodes())
    {
        if (node is FieldDeclarationSyntax field)
        {
            foreach (var variable in field.Declaration.Variables)
                Emit(variable.Identifier.Text, "field",
                     GetScopeFull(field), GetNamespace(field), null,
                     GetAccess(field.Modifiers), rel, GetLine(variable));
            continue;
        }

        if (node is EventFieldDeclarationSyntax evtField)
        {
            foreach (var variable in evtField.Declaration.Variables)
                Emit(variable.Identifier.Text, "event",
                     GetScopeFull(evtField), GetNamespace(evtField), null,
                     GetAccess(evtField.Modifiers), rel, GetLine(variable));
            continue;
        }

        string? name = null, kind = null, sig = null;
        SyntaxTokenList mods = default;

        switch (node)
        {
            case ClassDeclarationSyntax n:
                name = n.Identifier.Text; kind = "class"; mods = n.Modifiers; break;
            case InterfaceDeclarationSyntax n:
                name = n.Identifier.Text; kind = "interface"; mods = n.Modifiers; break;
            case StructDeclarationSyntax n:
                name = n.Identifier.Text; kind = "struct"; mods = n.Modifiers; break;
            case EnumDeclarationSyntax n:
                name = n.Identifier.Text; kind = "enum"; mods = n.Modifiers; break;
            case RecordDeclarationSyntax n:
                name = n.Identifier.Text;
                kind = n.ClassOrStructKeyword.IsKind(SyntaxKind.StructKeyword) ? "record_struct" : "record";
                mods = n.Modifiers; break;
            case DelegateDeclarationSyntax n:
                name = n.Identifier.Text; kind = "delegate";
                sig  = MethodSig(n.ParameterList, n.ReturnType); mods = n.Modifiers; break;
            case MethodDeclarationSyntax n:
                name = n.Identifier.Text; kind = "method";
                sig  = MethodSig(n.ParameterList, n.ReturnType); mods = n.Modifiers; break;
            case ConstructorDeclarationSyntax n:
                name = n.Identifier.Text; kind = "constructor";
                sig  = ParamSig(n.ParameterList); mods = n.Modifiers; break;
            case PropertyDeclarationSyntax n:
                name = n.Identifier.Text; kind = "property"; mods = n.Modifiers; break;
            case EventDeclarationSyntax n:
                name = n.Identifier.Text; kind = "event"; mods = n.Modifiers; break;
            case EnumMemberDeclarationSyntax n:
                name = n.Identifier.Text; kind = "enumMember"; break;
            default:
                continue;
        }

        if (name == null) continue;

        Emit(name, kind!, GetScopeFull(node), GetNamespace(node),
             sig, GetAccess(mods), rel, GetLine(node));
    }
}

writer.Flush();
writer.Dispose();
Console.Error.WriteLine($"[extract] {symbolCount} symbols written to {outputFile}");

// ── Helpers ───────────────────────────────────────────────────────────────────
string? GetScopeFull(SyntaxNode node)
{
    var parts = new List<string>();
    for (var p = node.Parent; p != null; p = p.Parent)
        if (p is TypeDeclarationSyntax t) parts.Insert(0, t.Identifier.Text);
    return parts.Count == 0 ? null : string.Join(".", parts);
}

string? GetNamespace(SyntaxNode node)
{
    for (var p = node.Parent; p != null; p = p.Parent)
    {
        if (p is NamespaceDeclarationSyntax ns)           return ns.Name.ToString();
        if (p is FileScopedNamespaceDeclarationSyntax fs) return fs.Name.ToString();
    }
    return null;
}

string GetAccess(SyntaxTokenList mods)
{
    bool has(SyntaxKind k) => mods.Any(k);
    if (has(SyntaxKind.PublicKeyword))                                        return "public";
    if (has(SyntaxKind.ProtectedKeyword) && has(SyntaxKind.InternalKeyword)) return "protected internal";
    if (has(SyntaxKind.PrivateKeyword)   && has(SyntaxKind.ProtectedKeyword)) return "private protected";
    if (has(SyntaxKind.InternalKeyword))                                      return "internal";
    if (has(SyntaxKind.ProtectedKeyword))                                     return "protected";
    return "private";
}

string MethodSig(ParameterListSyntax plist, TypeSyntax returnType)
{
    var ps = string.Join(", ", plist.Parameters.Select(p => p.Type?.ToString() ?? "?"));
    return $"({ps}): {returnType}";
}

string ParamSig(ParameterListSyntax plist)
{
    var ps = string.Join(", ", plist.Parameters.Select(p => p.Type?.ToString() ?? "?"));
    return $"({ps})";
}

int GetLine(SyntaxNode  n) => n.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
int GetLine(SyntaxToken t) => t.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
