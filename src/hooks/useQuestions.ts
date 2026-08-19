import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Question } from '../types';

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('questions').select('*').order('order', { ascending: true });
    if (!error && data) {
      setQuestions(data as Question[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const addQuestion = async (question: Omit<Question, 'id'>) => {
    const { data, error } = await supabase.from('questions').insert([question]).select();
    if (!error && data) {
      setQuestions([...questions, data[0] as Question]);
    }
    return { data, error };
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (!error) {
      setQuestions(questions.filter(q => q.id !== id));
    }
    return { error };
  };

  return { questions, loading, addQuestion, deleteQuestion, refresh: fetchQuestions };
}
