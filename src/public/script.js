document.getElementById('question-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const questionContent = document.getElementById('question-content').value;
    if (!questionContent) {
        alert('问题内容不能为空！');
        return;
    }

    fetch('/questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 需要添加适当的认证头，如Bearer Token
        },
        body: JSON.stringify({
            content: questionContent,
            userEmail: 'user@example.com' // 这里需要替换为实际的用户邮箱或其他标识
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        alert('问题已提交！');
        // 清空表单
        document.getElementById('question-content').value = '';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('提交问题时发生错误。');
    });
});
