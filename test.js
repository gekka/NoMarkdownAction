function work(originalText, isInCell) {
    const lines = originalText.split('\n');

    let isInCodeBlock = false;
    let hasChange = false;
    const processedLines = lines.map(originalLine => {
        const trimmed = originalLine.trim();

        if (!isInCell) {
            if (/^\s*```/g.test(originalLine)) {
                isInCodeBlock = !isInCodeBlock;
            }

            if (isInCodeBlock) {
                return originalLine;
            }
        }

        let cleanLine = originalLine;

        if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length >= 2) {
            // セルの中身を個別に処理
            const cells = trimmed.split("|").map(cell => work(cell, true))
            if (cells.some(c => c.hasChange)) {
                cleanLine = cells.map(_ => _.text).join("|");
                hasChange = true;
            }
        }
        else {
            // インラインコードの削除 `code` -> code
            cleanLine = cleanLine.replace(/`([^`]+)`/g, '$1')

            // 太字・イタリックの削除 (**text**, *text*, __text__, _text_)
            cleanLine = cleanLine.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')

            //リンクを行全体に拡張
            let url = "";
            cleanLine = cleanLine.replace(/\[([^\]]+)\]\((.*)\)/g, (match, linkText, u) => {
                if (u != "") {
                    url = u;
                }
                return `${linkText}`;
            });
            if (url != "") {
                const markdownRegex = /^(\s*(?:#{1,6}|>+|\*|\-|\+|\d+\.|- [[ xX]])\s+)(.*)$/;
                const match = cleanLine.match(markdownRegex);
                if (match) {
                    cleanLine = `${match[1]}[${match[2]}](${url})`;
                }
                else {
                    cleanLine = `[${cleanLine}](${url})`;
                }
            }

            hasChange |= (cleanLine != originalLine);
        }

        return cleanLine;
    });

    return {
        text: (hasChange ? processedLines.join('\n') : originalText),
        hasChange: hasChange
    }
}

async function replaceBody() {
    const issue = context.payload.issue;
    const originalText = issue.body || '';

    if (originalText.length == 0) {
        return;
    }
    const result = work(originalText, false);
    if (result.hasChange) {
        // 本文そのものを書き換える（更新する）
        await github.rest.issues.update({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issue.number,
            body: cleaned
        });
    }
}

const testMD = `
# a\`B\`c

- abc\`def\`ghi
- 1 _2_ 3
- 12__34__56
- 123___[456](./index.html)___789
- 1*2*3
- 12**34**56
- 123***456***789

---

| \`Header\` [a](http://example.com) A| \`\`\`*Header* [b](http://example.com) B|
|--------|--------|
| Cell [c](http://example.com) C| Cell [d](http://example.com) D| 

---

# [codeblock](http://example.com#123)-xxx

\`\`\`javascript
    let a="\`123\`"; // \`aaa\`
    let b="_456_";
\`\`\` 

\`\`\`csharp
    var a="\`123\`"; // \`aaa\`
    var b="_456_";
\`\`\` 

`//.replace(/\`/g, "`");

const result = work(testMD, false);
console.log(result);
