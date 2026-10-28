using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

public sealed partial class MainWindow
{
    private void ClearQuiz()
    {
        activeQuiz = null;
        submitted = false;
        uncertain = false;
        submissionKey = null;
        answerOptions.Clear();
        QuizQuestions.Children.Clear();
        QuizTitle.Text = "";
        QuizResults.Text = "";
        QuizPanel.Visibility = Visibility.Collapsed;
        QuizCheckButton.Visibility = Visibility.Collapsed;
    }

    private async void QuizSelected(object sender, SelectionChangedEventArgs args)
    {
        var index = QuizItems.SelectedIndex;
        if (busy || !service.HasSession || index < 0 || index >= quizEntries.Count) return;
        ClearQuiz();
        busy = true;
        UpdateButtons();
        try
        {
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var detail = await service.OpenQuizAsync(quizEntries[index].Id, cancel.Token);
            activeQuiz = detail;
            submissionKey = Guid.NewGuid().ToString("N");
            QuizTitle.Text = detail.Title;
            QuizPanel.Visibility = Visibility.Visible;
            for (var i = 0; i < detail.Questions.Count; i++)
            {
                var question = detail.Questions[i];
                var group = new StackPanel { Spacing = 6 };
                group.Children.Add(new TextBlock {
                    Text = $"Question {i + 1} of {detail.Questions.Count}: {question.Prompt}",
                    TextWrapping = TextWrapping.Wrap
                });
                var selector = new ComboBox {
                    Header = $"Answer for question {i + 1}",
                    PlaceholderText = "Choose an answer",
                    MinWidth = 260,
                    MaxWidth = 650,
                    ItemsSource = question.Options
                };
                selector.SelectionChanged += (_, _) => UpdateButtons();
                answerOptions.Add(selector);
                group.Children.Add(selector);
                QuizQuestions.Children.Add(group);
            }
            ServiceStatus.Text = "Practice test loaded from CABO.";
        }
        catch (Exception)
        {
            ClearQuiz();
            ServiceStatus.Text = "Cannot load the assessment. Check the connection.";
        }
        finally { busy = false; UpdateButtons(); }
    }

    private void ShowAttempt(NativeQuizAttempt attempt)
    {
        if (activeQuiz is null || attempt.QuizId != activeQuiz.Id ||
            attempt.TotalQuestions != activeQuiz.Questions.Count)
            throw new InvalidOperationException("Unexpected assessment result.");
        var feedback = new List<string> {
            $"CABO result: {attempt.CorrectCount}/{attempt.TotalQuestions} correct ({attempt.Percentage}%)",
            "Automated practice feedback is not a verified qualification."
        };
        foreach (var item in attempt.Feedback.OrderBy(f => f.QuestionIndex))
            feedback.Add($"Question {item.QuestionIndex + 1}: " +
                (item.IsCorrect ? "Correct. " : "Review. ") + item.Explanation);
        QuizResults.Text = string.Join(Environment.NewLine, feedback);
        uncertain = false;
        QuizCheckButton.Visibility = Visibility.Collapsed;
    }

    private async void SubmitQuiz(object sender, RoutedEventArgs args)
    {
        if (busy || submitted || activeQuiz is null ||
            answerOptions.Count != activeQuiz.Questions.Count ||
            answerOptions.Any(x => x.SelectedIndex < 0) ||
            string.IsNullOrEmpty(submissionKey)) return;
        var id = activeQuiz.Id;
        var answers = answerOptions.Select(x => x.SelectedIndex).ToArray();
        submitted = true;
        busy = true;
        UpdateButtons();
        try
        {
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            var result = await service.SubmitQuizAsync(id, answers, submissionKey, cancel.Token);
            ShowAttempt(result);
        }
        catch (Exception)
        {
            uncertain = true;
            QuizResults.Text = "Submission outcome unknown. Check the saved result without a second submission.";
            QuizCheckButton.Visibility = Visibility.Visible;
        }
        finally { busy = false; UpdateButtons(); }
    }

    private async void CheckQuiz(object sender, RoutedEventArgs args)
    {
        if (busy || !uncertain || activeQuiz is null ||
            string.IsNullOrEmpty(submissionKey)) return;
        busy = true;
        UpdateButtons();
        try
        {
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var result = await service.CheckQuizSubmissionAsync(activeQuiz.Id, submissionKey, cancel.Token);
            ShowAttempt(result);
        }
        catch (Exception)
        {
            QuizResults.Text = "Result not confirmed. Contact an educator if this persists.";
        }
        finally { busy = false; UpdateButtons(); }
    }

    private void CloseQuiz(object sender, RoutedEventArgs args)
    {
        if (busy) return;
        QuizItems.SelectedIndex = -1;
        ClearQuiz();
        UpdateButtons();
    }
}
